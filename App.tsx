
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, Upload, Sliders, BrainCircuit, FileText, Bookmark as BookmarkIcon, Trash2, History, CheckCircle2, XCircle, RefreshCw, Palette, Quote, Copy, Check, AlertCircle, Layers, ChevronRight } from 'lucide-react';
import { Token, Quiz, Bookmark, Theme, Citation, DocumentPart } from './types';
import { DEFAULT_WPM, MIN_WPM, MAX_WPM, tokenize } from './constants';
import { analyzeDocumentStructure, extractSegmentText, generateQuiz } from './services/geminiService';
import ReaderDisplay from './components/ReaderDisplay';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('rsvp-theme') as Theme) || 'dark');
  const [text, setText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [wpm, setWpm] = useState<number>(DEFAULT_WPM);
  const [fontSize, setFontSize] = useState<number>(48);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [showQuiz, setShowQuiz] = useState<boolean>(false);
  const [citations, setCitations] = useState<Citation | null>(null);
  const [docParts, setDocParts] = useState<DocumentPart[]>([]);
  const [activePartId, setActivePartId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('rsvp-theme', theme);
  }, [theme]);

  const themeStyles = {
    dark: { bg: 'bg-slate-950', surface: 'bg-slate-900', border: 'border-slate-800', accent: 'indigo', accentBg: 'bg-indigo-600', accentText: 'text-indigo-400', accentShadow: 'shadow-indigo-500/20', ring: 'ring-indigo-500', button: 'hover:bg-indigo-600' },
    forest: { bg: 'bg-[#08120a]', surface: 'bg-[#0d1a0f]', border: 'border-emerald-900/30', accent: 'emerald', accentBg: 'bg-emerald-600', accentText: 'text-emerald-400', accentShadow: 'shadow-emerald-500/20', ring: 'ring-emerald-500', button: 'hover:bg-emerald-600' },
    sea: { bg: 'bg-[#05111a]', surface: 'bg-[#0a1a26]', border: 'border-sky-900/30', accent: 'sky', accentBg: 'bg-sky-600', accentText: 'text-sky-400', accentShadow: 'shadow-sky-500/20', ring: 'ring-sky-500', button: 'hover:bg-sky-600' }
  }[theme];

  const docId = useMemo(() => {
    if (!fileName) return "";
    return `rsvp-bookmarks-${fileName}`;
  }, [fileName]);

  useEffect(() => {
    if (!docId) { setBookmarks([]); return; }
    const saved = localStorage.getItem(docId);
    if (saved) { try { setBookmarks(JSON.parse(saved)); } catch (e) { setBookmarks([]); } }
    else { setBookmarks([]); }
  }, [docId]);

  useEffect(() => { if (docId) localStorage.setItem(docId, JSON.stringify(bookmarks)); }, [bookmarks, docId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);
    setIsPlaying(false);
    setText("");
    setDocParts([]);
    setCitations(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        setFileBase64(base64);
        
        if (file.type === 'application/pdf') {
          const { parts, citations } = await analyzeDocumentStructure(base64);
          setDocParts(parts);
          setCitations(citations);
          // Auto-load part 1
          if (parts.length > 0) loadPart(parts[0], base64);
        } else {
          const content = atob(base64);
          setText(content);
          setTokens(tokenize(content));
          setIsProcessing(false);
        }
      } catch (err: any) {
        setError(err.message || "Failed to process document structure.");
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const loadPart = async (part: DocumentPart, base64Override?: string) => {
    const b64 = base64Override || fileBase64;
    if (!b64) return;
    
    setIsProcessing(true);
    setIsPlaying(false);
    setActivePartId(part.id);
    setCurrentIndex(0);
    setQuiz(null);
    setShowQuiz(false);

    try {
      const extracted = await extractSegmentText(b64, part.title, part.description);
      setText(extracted);
      setTokens(tokenize(extracted));
    } catch (err: any) {
      setError("Failed to extract part: " + part.title);
    } finally {
      setIsProcessing(false);
    }
  };

  const nextWord = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= tokens.length - 1) {
        setIsPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  }, [tokens.length]);

  useEffect(() => {
    if (isPlaying && !isScrubbing && currentIndex < tokens.length) {
      const currentToken = tokens[currentIndex];
      const baseDelay = (60 / wpm) * 1000;
      const delay = currentToken.isPunctuation ? baseDelay * 2 : baseDelay;
      timerRef.current = setTimeout(nextWord, delay);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, currentIndex, tokens, wpm, nextWord, isScrubbing]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const resetReader = () => { setIsPlaying(false); setCurrentIndex(0); };

  const handleSaveBookmark = () => {
    if (!text || tokens.length === 0) return;
    const percentage = Math.round((currentIndex / (tokens.length - 1)) * 100);
    const newBookmark: Bookmark = {
      id: crypto.randomUUID(),
      index: currentIndex,
      percentage,
      timestamp: Date.now(),
      label: `Part ${activePartId}: ${tokens[currentIndex]?.text.substring(0, 15)}`
    };
    setBookmarks(prev => [newBookmark, ...prev].slice(0, 10));
  };

  const loadBookmark = (bookmark: Bookmark) => { setIsPlaying(false); setCurrentIndex(bookmark.index); };
  const deleteBookmark = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setBookmarks(prev => prev.filter(b => b.id !== id)); };

  const handleGenerateQuiz = async () => {
    if (!text) return;
    setIsProcessing(true);
    try {
      const q = await generateQuiz(text);
      setQuiz(q);
      setShowQuiz(true);
      setSelectedAnswers({});
    } catch (err) {
      setError("Failed to generate quiz.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, option: string) => {
    if (selectedAnswers[questionIndex]) return;
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: option }));
  };

  const handleCopyCitation = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updateIndexFromEvent = (clientX: number) => {
    if (!progressBarRef.current || tokens.length === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    setCurrentIndex(Math.floor(percentage * (tokens.length - 1)));
  };

  const handleProgressBarMouseDown = (e: React.MouseEvent) => {
    if (tokens.length === 0) return;
    setIsScrubbing(true);
    updateIndexFromEvent(e.clientX);
  };

  useEffect(() => {
    if (!isScrubbing) return;
    const handleMouseMove = (e: MouseEvent) => updateIndexFromEvent(e.clientX);
    const handleMouseUp = () => setIsScrubbing(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isScrubbing, tokens.length]);

  const progress = tokens.length > 0 ? (currentIndex / (tokens.length - 1)) * 100 : 0;
  const score = quiz ? Object.entries(selectedAnswers).reduce((acc, [idx, ans]) => acc + (ans === quiz.questions[parseInt(idx)].answer ? 1 : 0), 0) : 0;

  return (
    <div className={`min-h-screen ${themeStyles.bg} transition-colors duration-700 p-4 md:p-8 flex flex-col items-center`}>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-center">
        <header className="w-full mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${themeStyles.accentBg} p-2 rounded-lg shadow-lg transition-all duration-500`}><FileText className="text-white w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">RSVP Reader <span className={themeStyles.accentText}>{theme.toUpperCase()}</span></h1>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Academic Speed Reading</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`${themeStyles.surface} border ${themeStyles.border} p-1 rounded-full flex gap-1 shadow-inner`}>
              {['forest', 'sea', 'dark'].map((t) => (
                <button key={t} onClick={() => setTheme(t as Theme)} className={`w-8 h-8 rounded-full border-2 transition-all ${t === 'forest' ? 'bg-emerald-700' : t === 'sea' ? 'bg-sky-700' : 'bg-slate-800'} ${theme === t ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`} />
              ))}
            </div>
            <label className="cursor-pointer group">
              <div className={`flex items-center gap-2 ${themeStyles.surface} border ${themeStyles.border} px-4 py-2 rounded-full text-sm font-medium hover:bg-white/5 transition-all`}>
                <Upload className={`w-4 h-4 ${themeStyles.accentText}`} /><span className="text-white">Upload</span>
              </div>
              <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {error && (
          <div className="w-full mb-6 bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="text-red-500 mt-0.5" size={18} />
            <div className="flex-1">
              <h3 className="text-red-500 font-bold text-sm">Document Error</h3>
              <p className="text-red-400/80 text-xs leading-relaxed mt-1">{error}</p>
              <button onClick={() => setError(null)} className="text-[10px] uppercase font-bold text-red-500 mt-2 hover:underline">Dismiss</button>
            </div>
          </div>
        )}

        <main className="w-full grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
          {/* Main Reader Column */}
          <div className="lg:col-span-3 space-y-6">
            <div className="relative">
              {isProcessing && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-xl border border-white/10">
                  <div className={`w-12 h-12 border-4 ${themeStyles.accent === 'indigo' ? 'border-indigo-500' : themeStyles.accent === 'emerald' ? 'border-emerald-500' : 'border-sky-500'} border-t-transparent rounded-full animate-spin mb-4`} />
                  <p className={`${themeStyles.accentText} font-medium animate-pulse`}>AI is parsing document segment...</p>
                </div>
              )}
              <ReaderDisplay token={tokens[currentIndex] || null} fontSize={fontSize} theme={theme} />
              <div className="relative mt-6 px-1 select-none">
                <div ref={progressBarRef} onMouseDown={handleProgressBarMouseDown} className={`group relative w-full h-2 ${themeStyles.surface} rounded-full cursor-pointer touch-none`}>
                  <div className={`absolute top-0 left-0 h-full ${themeStyles.accentBg} rounded-full`} style={{ width: `${progress}%` }} />
                  <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 ${themeStyles.accentBg.replace('bg-', 'border-')}`} style={{ left: `calc(${progress}% - 8px)` }} />
                </div>
                <div className="flex justify-between mt-3 text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">
                  <span className={`${themeStyles.surface} px-1.5 py-0.5 rounded border ${themeStyles.border}`}>{Math.round(progress)}%</span>
                  <span>{activePartId ? `PART ${activePartId}: ` : ''}{currentIndex} / {tokens.length} WORDS</span>
                  <span className={`${themeStyles.surface} px-1.5 py-0.5 rounded border ${themeStyles.border}`}>FINISH</span>
                </div>
              </div>
            </div>

            <div className={`${themeStyles.surface} border ${themeStyles.border} rounded-xl p-6 shadow-xl`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button onClick={togglePlay} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-amber-500' : themeStyles.accentBg} text-white shadow-lg hover:scale-105`}>
                    {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
                  </button>
                  <button onClick={resetReader} className={`w-10 h-10 rounded-full border ${themeStyles.border} flex items-center justify-center text-slate-400 hover:text-white transition-all`} title="Reset"><RotateCcw size={18} /></button>
                  <button onClick={handleSaveBookmark} disabled={!text} className={`w-10 h-10 rounded-full border ${themeStyles.border} flex items-center justify-center text-slate-400 hover:text-white transition-all disabled:opacity-20`} title="Bookmark"><BookmarkIcon size={18} /></button>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white mono">{wpm} <span className="text-sm font-normal text-slate-500 uppercase tracking-widest">wpm</span></div>
                  <div className="text-[10px] text-slate-500 font-medium uppercase mt-1">Reading Speed</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider"><span>Speed</span><span>{wpm} WPM</span></div>
                  <input type="range" min={MIN_WPM} max={MAX_WPM} step={10} value={wpm} onChange={(e) => setWpm(parseInt(e.target.value))} className="w-full h-2 bg-black/20 rounded-lg appearance-none cursor-pointer" style={{ accentColor: theme === 'dark' ? '#6366f1' : theme === 'forest' ? '#10b981' : '#0ea5e9' }} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider"><span>Font Size</span><span>{fontSize}px</span></div>
                  <input type="range" min={12} max={82} step={1} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full h-2 bg-black/20 rounded-lg appearance-none cursor-pointer" style={{ accentColor: theme === 'dark' ? '#6366f1' : theme === 'forest' ? '#10b981' : '#0ea5e9' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Segments & Study Tools */}
          <div className="space-y-6">
            <div className={`${themeStyles.surface} border ${themeStyles.border} rounded-xl p-5 shadow-xl h-full flex flex-col transition-all duration-500`}>
              <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2">
                {/* Document Segments */}
                {docParts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                      <Layers size={14} className={themeStyles.accentText} />
                      <span>Document Parts</span>
                    </div>
                    <div className="space-y-1.5">
                      {docParts.map((p) => (
                        <button 
                          key={p.id} 
                          onClick={() => loadPart(p)}
                          disabled={isProcessing}
                          className={`w-full text-left p-3 rounded-lg border text-[11px] transition-all flex items-center justify-between group ${
                            activePartId === p.id 
                            ? `${themeStyles.accentBg} border-transparent text-white shadow-lg` 
                            : `${themeStyles.bg} border-${themeStyles.border} text-slate-300 hover:border-slate-500`
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="font-bold truncate">Part {p.id}: {p.title}</span>
                            <span className={`text-[9px] opacity-70 truncate`}>{p.description}</span>
                          </div>
                          <ChevronRight size={14} className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity`} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* History & Bookmarks */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between text-xs font-bold text-white uppercase tracking-wider">
                    <div className="flex items-center gap-2"><History size={14} className={themeStyles.accentText} /><span>Bookmarks</span></div>
                  </div>
                  {bookmarks.length === 0 ? (
                    <div className="text-[10px] text-slate-600 italic py-4 text-center border border-dashed border-white/10 rounded-lg">No bookmarks</div>
                  ) : (
                    <div className="space-y-2">
                      {bookmarks.map(b => (
                        <div key={b.id} onClick={() => loadBookmark(b)} className={`group flex items-center justify-between ${themeStyles.bg} border ${themeStyles.border} p-2 rounded-lg transition-all cursor-pointer hover:bg-white/5`}>
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            <span className="text-[10px] font-medium text-slate-200 truncate">{b.label}</span>
                            <span className="text-[9px] text-slate-500">{b.percentage}% in part</span>
                          </div>
                          <button onClick={(e) => deleteBookmark(b.id, e)} className="p-1 text-slate-600 hover:text-red-400 rounded transition-all"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quiz Generator */}
                <div className={`p-4 ${themeStyles.bg} rounded-lg border ${themeStyles.border} space-y-3`}>
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2"><BrainCircuit size={14} className={themeStyles.accentText}/>Retention Quiz</h3>
                  <p className="text-[10px] text-slate-400 leading-relaxed">Test your comprehension for the current segment.</p>
                  <button disabled={!text || isProcessing} onClick={handleGenerateQuiz} className={`w-full ${themeStyles.accentBg} ${themeStyles.button} disabled:opacity-50 transition-all text-white py-2 rounded-md text-[11px] font-bold uppercase tracking-widest shadow-lg`}>
                    Generate Part Quiz
                  </button>
                </div>

                {quiz && showQuiz && (
                  <div className={`mt-4 space-y-4 animate-in fade-in zoom-in-95 duration-500 ${themeStyles.bg} p-4 rounded-xl border ${themeStyles.border} shadow-2xl`}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-white text-[11px] font-bold truncate pr-2">Segment Check</h4>
                      <button onClick={() => setShowQuiz(false)} className="text-slate-500 hover:text-red-400 text-[10px] font-bold">CLOSE</button>
                    </div>
                    <div className="space-y-6">
                      {quiz.questions.map((q, qIdx) => {
                        const selected = selectedAnswers[qIdx];
                        return (
                          <div key={qIdx} className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-200 leading-tight">Q{qIdx + 1}: {q.question}</p>
                            <div className="grid grid-cols-1 gap-1.5">
                              {q.options.map((opt, oIdx) => {
                                let variantClass = `${themeStyles.surface} border ${themeStyles.border} text-slate-400 hover:border-slate-500`;
                                if (selected) {
                                  if (opt === q.answer) variantClass = "bg-emerald-500/10 border-emerald-500/50 text-emerald-400";
                                  else if (selected === opt) variantClass = "bg-red-500/10 border-red-500/50 text-red-400";
                                  else variantClass = "opacity-40 border-transparent text-slate-600";
                                }
                                return (
                                  <button key={oIdx} onClick={() => handleAnswerSelect(qIdx, opt)} disabled={!!selected} className={`text-left text-[10px] px-2.5 py-2 rounded border transition-all ${variantClass}`}>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {citations && (
          <section className="w-full mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className={`${themeStyles.surface} border ${themeStyles.border} rounded-2xl overflow-hidden shadow-2xl`}>
              <div className={`flex items-center justify-between p-5 border-b ${themeStyles.border}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${themeStyles.accentBg} bg-opacity-20`}><Quote className={themeStyles.accentText} size={20} /></div>
                  <div><h2 className="text-white font-bold text-lg tracking-tight">Academic Citations</h2><p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Automatic Bibliographic Generation</p></div>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {['apa7', 'mla9', 'chicago'].map((style) => (
                  <div key={style} className={`space-y-3 p-4 ${themeStyles.bg} rounded-xl border ${themeStyles.border} transition-all hover:border-slate-600 group relative`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${themeStyles.accentText}`}>{style.toUpperCase()} Edition</span>
                      <button onClick={() => handleCopyCitation((citations as any)?.[style] || '', style)} className="p-1.5 hover:bg-white/10 rounded transition-all opacity-0 group-hover:opacity-100">
                        {copiedId === style ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-500" />}
                      </button>
                    </div>
                    <div className="min-h-[60px]"><p className="text-xs text-slate-300 leading-relaxed italic">{(citations as any)[style]}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <footer className="mt-4 mb-12 text-center text-slate-500 text-[10px] uppercase tracking-[0.2em] font-medium shrink-0 flex items-center justify-center gap-6">
          <p>Efficiency Protocol</p><div className="w-1 h-1 bg-slate-800 rounded-full" /><p>Academic RSVP v2.5</p><div className="w-1 h-1 bg-slate-800 rounded-full" /><p>Powered by Gemini Flash</p>
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        body { margin: 0; overflow-x: hidden; }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; background: white; border-radius: 50%; cursor: pointer; border: 2px solid currentColor; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
      `}</style>
    </div>
  );
};

export default App;
