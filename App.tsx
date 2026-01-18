
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, Upload, Sliders, BrainCircuit, FileText, Bookmark as BookmarkIcon, Trash2, History, CheckCircle2, XCircle, RefreshCw, Palette, Quote, Copy, Check, AlertCircle, Layers, ChevronRight, Maximize2, Minimize2, Settings2, Mail, User, Github } from 'lucide-react';
import { Token, Quiz, Bookmark, Theme, Citation, DocumentPart } from './types';
import { DEFAULT_WPM, MIN_WPM, MAX_WPM, tokenize } from './constants';
import { analyzeDocumentStructure, extractSegmentText, generateQuiz } from './services/geminiService';
import ReaderDisplay from './components/ReaderDisplay';

const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 600 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logo-main-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4f46e5" />
        <stop offset="50%" stopColor="#9333ea" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
      <filter id="logo-neon-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <rect x="20" y="52" width="20" height="4" rx="2" fill="#4f46e5" opacity="0.4" />
    <rect x="35" y="65" width="25" height="4" rx="2" fill="#9333ea" opacity="0.6" />
    <rect x="15" y="78" width="15" height="4" rx="2" fill="#ec4899" opacity="0.5" />
    <path d="M80 30 L160 60 L80 90 L100 60 Z" fill="url(#logo-main-grad)" opacity="0.2" />
    <path d="M100 25 L180 60 L100 95 L120 60 Z" fill="url(#logo-main-grad)" opacity="0.3" />
    <path d="M125 20 L210 60 L125 100 L150 60 Z" fill="url(#logo-main-grad)" opacity="0.5" />
    <path d="M155 15 L250 60 L155 105 L185 60 Z" fill="url(#logo-main-grad)" filter="url(#logo-neon-glow)" />
    <text x="260" y="68" fill="white" style={{ fontFamily: 'Inter, Arial, sans-serif', fontWeight: 900, fontSize: '52px', letterSpacing: '-2px' }}>RSVP</text>
    <text x="260" y="95" fill="#94a3b8" style={{ fontFamily: 'Inter, Arial, sans-serif', fontWeight: 300, fontStyle: 'italic', fontSize: '20px', letterSpacing: '4px' }}>SPEED READ</text>
  </svg>
);

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
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('rsvp-theme', theme);
  }, [theme]);

  const themeStyles = {
    dark: { 
      bg: 'bg-slate-950', 
      surface: 'bg-slate-900', 
      border: 'border-slate-800', 
      accent: 'indigo', 
      accentBg: 'bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500', 
      accentText: 'text-pink-400', 
      accentShadow: 'shadow-pink-500/20', 
      ring: 'ring-pink-500', 
      button: 'hover:opacity-90' 
    },
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
    // Fix: Corrected variable declaration from 'new Bookmark' to 'newBookmark'
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
  
  return (
    <div className={`min-h-screen ${themeStyles.bg} transition-colors duration-700 p-4 md:p-8 flex flex-col items-center ${isZenMode ? 'justify-center overflow-hidden h-screen' : ''}`}>
      <div className={`w-full max-w-6xl mx-auto flex flex-col items-center transition-all duration-500 ${isZenMode ? 'max-w-4xl' : ''}`}>
        
        {/* Header - Hides in Zen Mode */}
        <header className={`w-full mb-10 flex items-center justify-between transition-all duration-500 ${isZenMode ? 'opacity-0 -translate-y-10 pointer-events-none absolute' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center gap-1 group">
            <Logo className="h-20 w-auto drop-shadow-2xl group-hover:scale-105 transition-transform duration-500" />
          </div>
          <div className="flex items-center gap-4">
            <div className={`${themeStyles.surface} border ${themeStyles.border} p-1 rounded-full flex gap-1 shadow-inner`}>
              {['forest', 'sea', 'dark'].map((t) => (
                <button key={t} onClick={() => setTheme(t as Theme)} className={`w-8 h-8 rounded-full border-2 transition-all ${t === 'forest' ? 'bg-emerald-700' : t === 'sea' ? 'bg-sky-700' : 'bg-slate-800'} ${theme === t ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`} />
              ))}
            </div>
            <label className="cursor-pointer group">
              <div className={`flex items-center gap-2 ${themeStyles.surface} border ${themeStyles.border} px-5 py-2.5 rounded-full text-sm font-bold hover:bg-white/5 transition-all shadow-lg`}>
                <Upload className={`w-4 h-4 ${themeStyles.accentText}`} /><span className="text-white hidden sm:inline">Upload PDF</span>
              </div>
              <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {error && !isZenMode && (
          <div className="w-full mb-6 bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="text-red-500 mt-0.5" size={18} />
            <div className="flex-1">
              <h3 className="text-red-500 font-bold text-sm">System Error</h3>
              <p className="text-red-400/80 text-xs leading-relaxed mt-1">{error}</p>
              <button onClick={() => setError(null)} className="text-[10px] uppercase font-bold text-red-500 mt-2 hover:underline">Dismiss</button>
            </div>
          </div>
        )}

        <main className={`w-full grid grid-cols-1 ${isZenMode ? '' : 'lg:grid-cols-4'} gap-8 mb-12 transition-all duration-500`}>
          <div className={`${isZenMode ? 'col-span-1' : 'lg:col-span-3'} space-y-6`}>
            <div className="relative group/reader">
              {isProcessing && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-xl border border-white/10">
                  <div className={`w-14 h-14 border-4 ${themeStyles.accent === 'indigo' ? 'border-blue-500' : themeStyles.accent === 'emerald' ? 'border-emerald-500' : 'border-sky-500'} border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(59,130,246,0.5)]`} />
                  <p className={`${themeStyles.accentText} font-bold tracking-widest text-xs uppercase animate-pulse`}>Optimizing Text Flow...</p>
                </div>
              )}
              
              {/* Zen Mode Toggle (Overlay) */}
              <button 
                onClick={() => setIsZenMode(!isZenMode)}
                className={`absolute top-4 right-4 z-20 p-2 rounded-lg bg-black/20 hover:bg-black/40 text-slate-400 hover:text-white border border-white/5 transition-all opacity-0 group-hover/reader:opacity-100 ${isZenMode ? 'opacity-100 top-2 right-2' : ''}`}
                title={isZenMode ? "Exit Zen Mode" : "Zen Mode"}
              >
                {isZenMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>

              <ReaderDisplay token={tokens[currentIndex] || null} fontSize={fontSize} theme={theme} />
              
              <div className="relative mt-8 px-1 select-none">
                <div ref={progressBarRef} onMouseDown={handleProgressBarMouseDown} className={`group relative w-full h-3 ${themeStyles.surface} rounded-full cursor-pointer touch-none shadow-inner`}>
                  <div className={`absolute top-0 left-0 h-full ${themeStyles.accentBg} rounded-full transition-all duration-200`} style={{ width: `${progress}%` }} />
                  <div className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-2xl border-2 ${themeStyles.accentBg.includes('gradient') ? 'border-pink-500' : themeStyles.accentBg.replace('bg-', 'border-')} cursor-grab active:cursor-grabbing transition-transform group-hover:scale-125`} style={{ left: `calc(${progress}% - 10px)` }} />
                </div>
                <div className="flex justify-between mt-4 text-[11px] text-slate-500 font-mono uppercase tracking-[0.2em] font-black">
                  <span className={`${themeStyles.surface} px-2 py-1 rounded border ${themeStyles.border} shadow-sm`}>{Math.round(progress)}% Progress</span>
                  <span className={`${isZenMode ? 'hidden sm:inline' : ''}`}>{activePartId ? `Segment ${activePartId} ` : ''}• Word {currentIndex} of {tokens.length}</span>
                  <button onClick={resetReader} className="hover:text-white transition-colors">Restart Cycle</button>
                </div>
              </div>
            </div>

            <div className={`${themeStyles.surface} border ${themeStyles.border} rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-500 ${isZenMode ? 'bg-opacity-50 border-opacity-20 translate-y-4' : ''}`}>
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 blur-3xl rounded-full pointer-events-none" />
              
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-5">
                  <button onClick={togglePlay} className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-amber-500' : themeStyles.accentBg} text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:scale-110 active:scale-95 group`}>
                    {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                  </button>
                  <div className={`flex flex-col gap-2 ${isZenMode ? 'hidden sm:flex' : ''}`}>
                    <button onClick={resetReader} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${themeStyles.border} text-slate-400 hover:text-white hover:border-slate-500 transition-all text-[10px] font-bold uppercase tracking-wider`}><RotateCcw size={14} /> Reset</button>
                    <button onClick={handleSaveBookmark} disabled={!text} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${themeStyles.border} text-slate-400 hover:text-white hover:border-slate-500 transition-all text-[10px] font-bold uppercase tracking-wider disabled:opacity-20`}><BookmarkIcon size={14} /> Bookmark</button>
                  </div>
                </div>
                
                {/* Minimal Zen Controls for Speed/Size */}
                {isZenMode && (
                   <div className="flex items-center gap-6">
                      <div className="flex flex-col items-end">
                         <span className="text-2xl font-black text-white">{wpm}</span>
                         <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">WPM</span>
                      </div>
                      <button onClick={() => setIsZenMode(false)} className="p-3 bg-white/5 rounded-xl text-slate-400 hover:text-white border border-white/5">
                        <Settings2 size={20} />
                      </button>
                   </div>
                )}

                <div className={`text-right ${isZenMode ? 'hidden' : ''}`}>
                  <div className="text-5xl font-black text-white leading-none tracking-tighter">{wpm}</div>
                  <div className="text-[10px] text-slate-500 font-black uppercase mt-2 tracking-[0.3em]">Words Per Minute</div>
                </div>
              </div>
              
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10 transition-all duration-500 ${isZenMode ? 'opacity-30 hover:opacity-100' : 'opacity-100'}`}>
                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><span>Reading Velocity</span><span>{wpm} WPM</span></div>
                  <input type="range" min={MIN_WPM} max={MAX_WPM} step={10} value={wpm} onChange={(e) => setWpm(parseInt(e.target.value))} className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer" style={{ accentColor: theme === 'dark' ? '#ec4899' : theme === 'forest' ? '#10b981' : '#0ea5e9' }} />
                  <div className="flex justify-between px-1">
                    <span className="text-[9px] text-slate-600 font-bold uppercase">Zen</span>
                    <span className="text-[9px] text-slate-600 font-bold uppercase">Turbo</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><span>Visual Scale</span><span>{fontSize}px</span></div>
                  <input type="range" min={12} max={82} step={1} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer" style={{ accentColor: theme === 'dark' ? '#ec4899' : theme === 'forest' ? '#10b981' : '#0ea5e9' }} />
                  <div className="flex justify-between px-1">
                    <span className="text-[9px] text-slate-600 font-bold uppercase">Micro</span>
                    <span className="text-[9px] text-slate-600 font-bold uppercase">Maxi</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Hides in Zen Mode */}
          <div className={`space-y-6 transition-all duration-500 ${isZenMode ? 'hidden' : 'opacity-100 scale-100'}`}>
            <div className={`${themeStyles.surface} border ${themeStyles.border} rounded-2xl p-6 shadow-2xl h-full flex flex-col transition-all duration-500 overflow-hidden`}>
              <div className="flex-1 space-y-8 overflow-y-auto custom-scrollbar pr-2">
                {docParts.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-xs font-black text-white uppercase tracking-[0.2em]">
                      <Layers size={16} className={themeStyles.accentText} />
                      <span>Segments</span>
                    </div>
                    <div className="space-y-2">
                      {docParts.map((p) => (
                        <button 
                          key={p.id} 
                          onClick={() => loadPart(p)}
                          disabled={isProcessing}
                          className={`w-full text-left p-4 rounded-xl border text-[11px] transition-all flex items-center justify-between group relative overflow-hidden ${
                            activePartId === p.id 
                            ? `text-white shadow-xl scale-[1.02] border-transparent z-10` 
                            : `${themeStyles.bg} border-${themeStyles.border} text-slate-400 hover:border-slate-600`
                          }`}
                        >
                          {activePartId === p.id && (
                            <div className={`absolute inset-0 ${themeStyles.accentBg} -z-10`} />
                          )}
                          <div className="flex flex-col gap-1 overflow-hidden">
                            <span className="font-black uppercase tracking-wider truncate">Part {p.id}: {p.title}</span>
                            <span className={`text-[9px] opacity-70 truncate font-medium`}>{p.description}</span>
                          </div>
                          <ChevronRight size={16} className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity`} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4 border-t border-white/5 pt-6">
                  <div className="flex items-center justify-between text-xs font-black text-white uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-3"><History size={16} className={themeStyles.accentText} /><span>History</span></div>
                  </div>
                  {bookmarks.length === 0 ? (
                    <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest py-8 text-center border border-dashed border-white/10 rounded-2xl bg-black/10">Empty Log</div>
                  ) : (
                    <div className="space-y-2">
                      {bookmarks.map(b => (
                        <div key={b.id} onClick={() => loadBookmark(b)} className={`group flex items-center justify-between ${themeStyles.bg} border ${themeStyles.border} p-3 rounded-xl transition-all cursor-pointer hover:bg-white/5 hover:border-slate-600`}>
                          <div className="flex flex-col gap-1 overflow-hidden">
                            <span className="text-[10px] font-black text-slate-200 uppercase tracking-wide truncate">{b.label}</span>
                            <span className="text-[9px] text-slate-500 font-bold">{b.percentage}% Progress</span>
                          </div>
                          <button onClick={(e) => deleteBookmark(b.id, e)} className="p-2 text-slate-700 hover:text-red-500 rounded-lg transition-all"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`p-5 ${themeStyles.bg} rounded-2xl border ${themeStyles.border} space-y-4 shadow-inner relative overflow-hidden`}>
                   <div className="absolute top-0 right-0 p-2 opacity-5"><BrainCircuit size={48} /></div>
                  <h3 className="text-white text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3"><BrainCircuit size={16} className={themeStyles.accentText}/>Retention Unit</h3>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Cognitive assessment for the current text cycle.</p>
                  <button disabled={!text || isProcessing} onClick={handleGenerateQuiz} className={`w-full ${themeStyles.accentBg} ${themeStyles.button} disabled:opacity-50 transition-all text-white py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95`}>
                    Launch Assessment
                  </button>
                </div>

                {quiz && showQuiz && (
                  <div className={`mt-4 space-y-6 animate-in fade-in zoom-in-95 duration-500 ${themeStyles.bg} p-6 rounded-2xl border ${themeStyles.border} shadow-2xl`}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Checkpoints</h4>
                      <button onClick={() => setShowQuiz(false)} className="text-slate-500 hover:text-white text-[9px] font-black uppercase tracking-widest border border-slate-800 px-2 py-1 rounded">End</button>
                    </div>
                    <div className="space-y-8">
                      {quiz.questions.map((q, qIdx) => {
                        const selected = selectedAnswers[qIdx];
                        return (
                          <div key={qIdx} className="space-y-3">
                            <p className="text-[11px] font-bold text-slate-100 leading-normal">#{qIdx + 1} {q.question}</p>
                            <div className="grid grid-cols-1 gap-2">
                              {q.options.map((opt, oIdx) => {
                                let variantClass = `${themeStyles.surface} border ${themeStyles.border} text-slate-400 hover:border-slate-500`;
                                if (selected) {
                                  if (opt === q.answer) variantClass = "bg-emerald-500/10 border-emerald-500/50 text-emerald-400";
                                  else if (selected === opt) variantClass = "bg-red-500/10 border-red-500/50 text-red-400";
                                  else variantClass = "opacity-40 border-transparent text-slate-600";
                                }
                                return (
                                  <button key={oIdx} onClick={() => handleAnswerSelect(qIdx, opt)} disabled={!!selected} className={`text-left text-[10px] px-4 py-3 rounded-xl border font-medium transition-all ${variantClass}`}>
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

        {/* Footer Citations - Hide in Zen Mode */}
        {citations && !isZenMode && (
          <section className="w-full mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className={`${themeStyles.surface} border ${themeStyles.border} rounded-3xl overflow-hidden shadow-2xl`}>
              <div className={`flex items-center justify-between p-8 border-b ${themeStyles.border} bg-black/20`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${themeStyles.accentBg} bg-opacity-20`}><Quote className={themeStyles.accentText} size={24} /></div>
                  <div><h2 className="text-white font-black text-xl tracking-tighter uppercase italic">Citations</h2><p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mt-1">Academic Protocol Library</p></div>
                </div>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                {['apa7', 'mla9', 'chicago'].map((style) => (
                  <div key={style} className={`space-y-4 p-6 ${themeStyles.bg} rounded-2xl border ${themeStyles.border} transition-all hover:border-slate-600 group relative shadow-inner`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${themeStyles.accentText}`}>{style} Edition</span>
                      <button onClick={() => handleCopyCitation((citations as any)?.[style] || '', style)} className="p-2 hover:bg-white/10 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                        {copiedId === style ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-slate-500" />}
                      </button>
                    </div>
                    <div className="min-h-[80px]"><p className="text-[11px] text-slate-300 leading-relaxed italic font-medium">{(citations as any)[style]}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <footer className={`mt-8 mb-16 flex flex-col items-center gap-6 transition-all duration-500 ${isZenMode ? 'opacity-0 pointer-events-none' : ''}`}>
          {/* System Status Line */}
          <div className="flex items-center justify-center gap-8 text-slate-600 text-[10px] uppercase tracking-[0.4em] font-black opacity-60">
            <p>Sync Verified</p>
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
            <p>Protocol RSVP v2.5</p>
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
            <p>Core: Gemini 3 Flash</p>
          </div>

          {/* Author/Contact Branding Line */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-slate-500 text-[11px] font-bold tracking-[0.1em] transition-all">
            <div className="flex items-center gap-2 group">
              <User size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
              <span className="uppercase text-slate-400">Author:</span>
              <span className="text-slate-300">Tyler Maire</span>
            </div>
            <div className="hidden sm:block w-px h-3 bg-slate-800" />
            <a 
              href="mailto:tyler.maire1@gmail.com" 
              className="flex items-center gap-2 group hover:text-white transition-all"
            >
              <Mail size={14} className="opacity-40 group-hover:opacity-100 group-hover:text-blue-400 transition-all" />
              <span className="uppercase text-slate-400">Contact:</span>
              <span className="underline underline-offset-4 decoration-slate-700 group-hover:decoration-blue-500">tyler.maire1@gmail.com</span>
            </a>
            <div className="hidden sm:block w-px h-3 bg-slate-800" />
            <a 
              href="https://github.com/tylermaire/RSVP-Speed-Reader-" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 group hover:text-white transition-all"
            >
              <Github size={14} className="opacity-40 group-hover:opacity-100 group-hover:text-purple-400 transition-all" />
              <span className="uppercase text-slate-400">Source:</span>
              <span className="underline underline-offset-4 decoration-slate-700 group-hover:decoration-purple-500">GitHub</span>
            </a>
          </div>
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
        body { margin: 0; overflow-x: hidden; letter-spacing: -0.01em; }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; background: white; border-radius: 50%; cursor: pointer; border: 4px solid currentColor; box-shadow: 0 5px 15px rgba(0,0,0,0.4); transition: transform 0.2s; }
        input[type='range']::-webkit-slider-thumb:hover { transform: scale(1.15); }
        
        @media (max-width: 640px) {
          input[type='range']::-webkit-slider-thumb { width: 28px; height: 28px; }
        }
      `}</style>
    </div>
  );
};

export default App;
