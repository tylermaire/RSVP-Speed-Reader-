
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, Upload, Sliders, BrainCircuit, FileText, Bookmark as BookmarkIcon, Trash2, History, CheckCircle2, XCircle, RefreshCw, Palette, Quote, Copy, Check } from 'lucide-react';
import { Token, Quiz, Bookmark, Theme, Citation } from './types';
import { DEFAULT_WPM, MIN_WPM, MAX_WPM, tokenize } from './constants';
import { extractTextFromPdf, generateQuiz, generateCitations } from './services/geminiService';
import ReaderDisplay from './components/ReaderDisplay';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('rsvp-theme') as Theme) || 'dark';
  });
  const [text, setText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [wpm, setWpm] = useState<number>(DEFAULT_WPM);
  const [fontSize, setFontSize] = useState<number>(48);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [showQuiz, setShowQuiz] = useState<boolean>(false);
  const [citations, setCitations] = useState<Citation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Persistence for theme
  useEffect(() => {
    localStorage.setItem('rsvp-theme', theme);
  }, [theme]);

  // Theme Configuration
  const themeStyles = {
    dark: {
      bg: 'bg-slate-950',
      surface: 'bg-slate-900',
      border: 'border-slate-800',
      accent: 'indigo',
      accentBg: 'bg-indigo-600',
      accentText: 'text-indigo-400',
      accentShadow: 'shadow-indigo-500/20',
      ring: 'ring-indigo-500',
      button: 'hover:bg-indigo-600',
    },
    forest: {
      bg: 'bg-[#08120a]',
      surface: 'bg-[#0d1a0f]',
      border: 'border-emerald-900/30',
      accent: 'emerald',
      accentBg: 'bg-emerald-600',
      accentText: 'text-emerald-400',
      accentShadow: 'shadow-emerald-500/20',
      ring: 'ring-emerald-500',
      button: 'hover:bg-emerald-600',
    },
    sea: {
      bg: 'bg-[#05111a]',
      surface: 'bg-[#0a1a26]',
      border: 'border-sky-900/30',
      accent: 'sky',
      accentBg: 'bg-sky-600',
      accentText: 'text-sky-400',
      accentShadow: 'shadow-sky-500/20',
      ring: 'ring-sky-500',
      button: 'hover:bg-sky-600',
    }
  }[theme];

  const docId = useMemo(() => {
    if (!text) return "";
    const hash = text.substring(0, 200).split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `rsvp-bookmarks-${hash}-${fileName}`;
  }, [text, fileName]);

  useEffect(() => {
    if (!docId) {
      setBookmarks([]);
      return;
    }
    const saved = localStorage.getItem(docId);
    if (saved) {
      try {
        setBookmarks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse bookmarks", e);
        setBookmarks([]);
      }
    } else {
      setBookmarks([]);
    }
  }, [docId]);

  useEffect(() => {
    if (docId) {
      localStorage.setItem(docId, JSON.stringify(bookmarks));
    }
  }, [bookmarks, docId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setIsPlaying(false);
    setCurrentIndex(0);
    setQuiz(null);
    setCitations(null);
    setSelectedAnswers({});
    setFileName(file.name);

    try {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const extracted = await extractTextFromPdf(base64);
          setText(extracted);
          setTokens(tokenize(extracted));
          
          // Generate citations concurrently after extraction
          generateCitations(extracted).then(setCitations).catch(err => console.error("Citation gen failed", err));
          
          setIsProcessing(false);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setText(content);
          setTokens(tokenize(content));
          
          generateCitations(content).then(setCitations).catch(err => console.error("Citation gen failed", err));
          
          setIsProcessing(false);
        };
        reader.readAsText(file);
      }
    } catch (err) {
      console.error("Upload failed", err);
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
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIndex, tokens, wpm, nextWord, isScrubbing]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const resetReader = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleSaveBookmark = () => {
    if (!text || tokens.length === 0) return;
    
    const percentage = Math.round((currentIndex / (tokens.length - 1)) * 100);
    const newBookmark: Bookmark = {
      id: crypto.randomUUID(),
      index: currentIndex,
      percentage,
      timestamp: Date.now(),
      label: tokens[currentIndex]?.text.substring(0, 20) || `Position ${currentIndex}`
    };

    setBookmarks(prev => [newBookmark, ...prev].slice(0, 10));
  };

  const loadBookmark = (bookmark: Bookmark) => {
    setIsPlaying(false);
    setCurrentIndex(bookmark.index);
  };

  const deleteBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const handleGenerateQuiz = async () => {
    if (!text) return;
    setIsProcessing(true);
    try {
      const q = await generateQuiz(text);
      setQuiz(q);
      setShowQuiz(true);
      setSelectedAnswers({});
      setIsProcessing(false);
    } catch (err) {
      console.error("Quiz generation failed", err);
      setIsProcessing(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, option: string) => {
    if (selectedAnswers[questionIndex]) return;
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: option }));
  };

  const resetQuiz = () => {
    setSelectedAnswers({});
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
    const newIndex = Math.floor(percentage * (tokens.length - 1));
    setCurrentIndex(newIndex);
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
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, tokens.length]);

  const progress = tokens.length > 0 ? (currentIndex / (tokens.length - 1)) * 100 : 0;
  
  const score = quiz ? Object.entries(selectedAnswers).reduce((acc, [idx, ans]) => {
    return acc + (ans === quiz.questions[parseInt(idx)].answer ? 1 : 0);
  }, 0) : 0;

  return (
    <div className={`min-h-screen ${themeStyles.bg} transition-colors duration-700 p-4 md:p-8 flex flex-col items-center`}>
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
        <header className="w-full mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${themeStyles.accentBg} p-2 rounded-lg shadow-lg ${themeStyles.accentShadow} transition-all duration-500`}>
              <FileText className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">RSVP Reader <span className={themeStyles.accentText}>{theme === 'dark' ? 'Pro' : theme.toUpperCase()}</span></h1>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Rapid Serial Visual Presentation</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`${themeStyles.surface} border ${themeStyles.border} p-1 rounded-full flex gap-1 shadow-inner`}>
              <button 
                onClick={() => setTheme('forest')}
                className={`w-8 h-8 rounded-full bg-emerald-700 border-2 ${theme === 'forest' ? 'border-white scale-110' : 'border-transparent'} transition-all`}
                title="Forest Theme"
              />
              <button 
                onClick={() => setTheme('sea')}
                className={`w-8 h-8 rounded-full bg-sky-700 border-2 ${theme === 'sea' ? 'border-white scale-110' : 'border-transparent'} transition-all`}
                title="Sea Theme"
              />
              <button 
                onClick={() => setTheme('dark')}
                className={`w-8 h-8 rounded-full bg-slate-800 border-2 ${theme === 'dark' ? 'border-white scale-110' : 'border-transparent'} transition-all`}
                title="Dark Theme"
              />
            </div>

            <label className="cursor-pointer group">
              <div className={`flex items-center gap-2 ${themeStyles.surface} hover:bg-opacity-80 transition-all border ${themeStyles.border} px-4 py-2 rounded-full text-sm font-medium`}>
                <Upload className={`w-4 h-4 ${themeStyles.accentText} group-hover:scale-110 transition-transform`} />
                <span className="text-white">Upload</span>
              </div>
              <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        <main className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Left Column: Reader & Controls */}
          <div className="lg:col-span-2 space-y-6">
            <div className="relative">
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl border border-white/10">
                  <div className={`w-12 h-12 border-4 ${themeStyles.accentText === 'text-indigo-400' ? 'border-indigo-500' : themeStyles.accentText === 'text-emerald-400' ? 'border-emerald-500' : 'border-sky-500'} border-t-transparent rounded-full animate-spin mb-4`}></div>
                  <p className={`${themeStyles.accentText} font-medium animate-pulse`}>AI is reading your document...</p>
                </div>
              )}
              
              <ReaderDisplay token={tokens[currentIndex] || null} fontSize={fontSize} theme={theme} />
              
              <div className="relative mt-6 px-1 select-none">
                <div 
                  ref={progressBarRef}
                  onMouseDown={handleProgressBarMouseDown}
                  className={`group relative w-full h-2 ${themeStyles.surface} rounded-full cursor-pointer touch-none`}
                >
                  <div 
                    className={`absolute top-0 left-0 h-full ${themeStyles.accentBg} rounded-full transition-all duration-75`}
                    style={{ width: `${progress}%` }}
                  ></div>
                  <div 
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg shadow-black/50 border-2 ${themeStyles.accentBg.replace('bg-', 'border-')} transition-all duration-75 hover:scale-125 group-active:scale-150`}
                    style={{ left: `calc(${progress}% - 8px)` }}
                  ></div>
                </div>

                <div className="flex justify-between mt-3 text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">
                  <span className={`${themeStyles.surface} px-1.5 py-0.5 rounded border ${themeStyles.border}`}>{Math.round(progress)}%</span>
                  <span>{currentIndex} / {tokens.length} WORDS</span>
                  <span className={`${themeStyles.surface} px-1.5 py-0.5 rounded border ${themeStyles.border}`}>FINISH</span>
                </div>
              </div>
            </div>

            <div className={`${themeStyles.surface} border ${themeStyles.border} rounded-xl p-6 shadow-xl transition-all duration-500`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={togglePlay}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-amber-500 shadow-amber-500/20' : themeStyles.accentBg + ' ' + themeStyles.accentShadow} shadow-lg hover:scale-105 active:scale-95 text-white`}
                  >
                    {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
                  </button>
                  <button 
                    onClick={resetReader}
                    className={`w-10 h-10 rounded-full border ${themeStyles.border} flex items-center justify-center text-slate-400 hover:text-white transition-all`}
                    title="Reset to beginning"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button 
                    onClick={handleSaveBookmark}
                    disabled={!text}
                    className={`w-10 h-10 rounded-full border ${themeStyles.border} flex items-center justify-center text-slate-400 hover:text-white transition-all disabled:opacity-20`}
                    title="Save Bookmark"
                  >
                    <BookmarkIcon size={18} />
                  </button>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-bold text-white mono">{wpm} <span className="text-sm font-normal text-slate-500 uppercase tracking-widest">wpm</span></div>
                  <div className="text-[10px] text-slate-500 font-medium uppercase mt-1 tracking-tighter">Reading Speed</div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <Sliders size={12} className={themeStyles.accentText} />
                      <span>Speed</span>
                    </div>
                    <span>{wpm} WPM</span>
                  </div>
                  <input 
                    type="range" 
                    min={MIN_WPM} 
                    max={MAX_WPM} 
                    step={10} 
                    value={wpm} 
                    onChange={(e) => setWpm(parseInt(e.target.value))}
                    className={`w-full h-2 ${themeStyles.bg} rounded-lg appearance-none cursor-pointer accent-${themeStyles.accent}-500`}
                    style={{ accentColor: theme === 'dark' ? '#6366f1' : theme === 'forest' ? '#10b981' : '#0ea5e9' }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Font Size</span>
                    <span>{fontSize}px</span>
                  </div>
                  <input 
                    type="range" 
                    min={12} 
                    max={82} 
                    step={1}
                    value={fontSize} 
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className={`w-full h-2 ${themeStyles.bg} rounded-lg appearance-none cursor-pointer`}
                    style={{ accentColor: theme === 'dark' ? '#6366f1' : theme === 'forest' ? '#10b981' : '#0ea5e9' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: AI Insights & Study Tools */}
          <div className="space-y-6">
            <div className={`${themeStyles.surface} border ${themeStyles.border} rounded-xl p-6 shadow-xl h-full flex flex-col overflow-hidden transition-all duration-500`}>
              <div className={`flex items-center gap-2 mb-6 border-b ${themeStyles.border} pb-4 shrink-0`}>
                <BrainCircuit className={themeStyles.accentText} size={20} />
                <h2 className="font-bold text-white uppercase tracking-wider text-sm">Study Hub</h2>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2 pb-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2 text-white/80">
                      <History size={14} className={themeStyles.accentText} />
                      <span>Bookmarks</span>
                    </div>
                    <span className={`text-[10px] ${themeStyles.bg} px-1.5 rounded border ${themeStyles.border}`}>{bookmarks.length}</span>
                  </div>
                  
                  {bookmarks.length === 0 ? (
                    <div className={`text-[10px] text-slate-600 italic py-6 text-center border border-dashed ${themeStyles.border} rounded-lg`}>
                      No bookmarks saved
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bookmarks.map(b => (
                        <div 
                          key={b.id} 
                          onClick={() => loadBookmark(b)}
                          className={`group flex items-center justify-between ${themeStyles.bg} hover:bg-opacity-60 border ${themeStyles.border} p-2.5 rounded-lg transition-all cursor-pointer`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
                              {b.label}...
                            </span>
                            <span className="text-[9px] text-slate-500">
                              {b.percentage}% done
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`h-6 w-1 ${themeStyles.accentBg} opacity-40 rounded-full group-hover:opacity-100 transition-opacity`}></div>
                            <button 
                              onClick={(e) => deleteBookmark(b.id, e)}
                              className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`p-4 ${themeStyles.bg} rounded-lg border ${themeStyles.border} bg-opacity-50`}>
                  <h3 className="text-white text-sm font-semibold mb-2">Comprehension Test</h3>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    Finished reading? Generate an AI quiz to verify your retention.
                  </p>
                  <button 
                    disabled={!text || isProcessing}
                    onClick={handleGenerateQuiz}
                    className={`w-full ${themeStyles.accentBg} ${themeStyles.button} disabled:opacity-50 transition-all text-white py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 shadow-lg`}
                  >
                    <BrainCircuit size={16} />
                    Generate Quiz
                  </button>
                </div>

                {quiz && showQuiz && (
                  <div className={`mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ${themeStyles.bg} p-4 rounded-xl border ${themeStyles.border} bg-opacity-70 shadow-2xl`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white text-sm font-bold truncate pr-4">{quiz.title}</h4>
                        <p className={`text-[10px] ${themeStyles.accentText} uppercase tracking-tighter font-bold mt-0.5`}>
                          Score: {score} / {quiz.questions.length}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={resetQuiz} title="Reset Quiz" className="text-slate-500 hover:text-white transition-colors">
                          <RefreshCw size={14} />
                        </button>
                        <button onClick={() => setShowQuiz(false)} className="text-slate-500 hover:text-red-400 text-xs font-bold">CLOSE</button>
                      </div>
                    </div>
                    <div className="space-y-8 mt-4">
                      {quiz.questions.map((q, qIdx) => {
                        const selected = selectedAnswers[qIdx];
                        const isCorrect = selected === q.answer;
                        
                        return (
                          <div key={qIdx} className="space-y-3">
                            <p className="text-xs font-semibold text-slate-200 leading-tight border-l-2 pl-2" style={{ borderColor: theme === 'dark' ? '#6366f1' : theme === 'forest' ? '#10b981' : '#0ea5e9' }}>
                              {qIdx + 1}. {q.question}
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                              {q.options.map((opt, oIdx) => {
                                const isThisSelected = selected === opt;
                                const isThisCorrect = opt === q.answer;
                                
                                let variantClass = `${themeStyles.surface} border ${themeStyles.border} text-slate-400 hover:border-slate-400`;
                                if (selected) {
                                  if (isThisCorrect) {
                                    variantClass = "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]";
                                  } else if (isThisSelected) {
                                    variantClass = "bg-red-500/10 border-red-500/50 text-red-400";
                                  } else {
                                    variantClass = "bg-opacity-20 opacity-40 border-transparent text-slate-600";
                                  }
                                }

                                return (
                                  <button
                                    key={oIdx}
                                    onClick={() => handleAnswerSelect(qIdx, opt)}
                                    disabled={!!selected}
                                    className={`group relative flex items-center justify-between text-[11px] px-3 py-2.5 rounded-lg border transition-all text-left ${variantClass}`}
                                  >
                                    <span className="pr-6 leading-snug">{opt}</span>
                                    {selected && isThisCorrect && <CheckCircle2 size={14} className="shrink-0" />}
                                    {selected && isThisSelected && !isCorrect && <XCircle size={14} className="shrink-0" />}
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

        {/* Citations Box Section */}
        {text && (
          <section className={`w-full mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300`}>
            <div className={`${themeStyles.surface} border ${themeStyles.border} rounded-2xl overflow-hidden shadow-2xl`}>
              <div className={`flex items-center justify-between p-5 border-b ${themeStyles.border}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${themeStyles.accentBg} bg-opacity-20`}>
                    <Quote className={themeStyles.accentText} size={20} />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg tracking-tight">Academic Citations</h2>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Automatic Bibliographic Generation</p>
                  </div>
                </div>
                {!citations && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-slate-500 font-medium">Identifying Metadata...</span>
                  </div>
                )}
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* APA Citation */}
                <div className={`space-y-3 p-4 ${themeStyles.bg} rounded-xl border ${themeStyles.border} transition-all hover:border-slate-600 group`}>
                   <div className="flex items-center justify-between">
                     <span className={`text-[10px] font-bold uppercase tracking-widest ${themeStyles.accentText}`}>APA 7th Edition</span>
                     <button 
                      onClick={() => handleCopyCitation(citations?.apa7 || '', 'apa')}
                      className="p-1.5 hover:bg-white/10 rounded transition-all opacity-0 group-hover:opacity-100"
                     >
                       {copiedId === 'apa' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-500" />}
                     </button>
                   </div>
                   <div className="min-h-[60px]">
                      {citations ? (
                        <p className="text-xs text-slate-300 leading-relaxed italic">{citations.apa7}</p>
                      ) : (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-2 bg-white/5 rounded w-full"></div>
                          <div className="h-2 bg-white/5 rounded w-3/4"></div>
                        </div>
                      )}
                   </div>
                </div>

                {/* MLA Citation */}
                <div className={`space-y-3 p-4 ${themeStyles.bg} rounded-xl border ${themeStyles.border} transition-all hover:border-slate-600 group`}>
                   <div className="flex items-center justify-between">
                     <span className={`text-[10px] font-bold uppercase tracking-widest ${themeStyles.accentText}`}>MLA 9th Edition</span>
                     <button 
                      onClick={() => handleCopyCitation(citations?.mla9 || '', 'mla')}
                      className="p-1.5 hover:bg-white/10 rounded transition-all opacity-0 group-hover:opacity-100"
                     >
                       {copiedId === 'mla' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-500" />}
                     </button>
                   </div>
                   <div className="min-h-[60px]">
                      {citations ? (
                        <p className="text-xs text-slate-300 leading-relaxed italic">{citations.mla9}</p>
                      ) : (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-2 bg-white/5 rounded w-full"></div>
                          <div className="h-2 bg-white/5 rounded w-3/4"></div>
                        </div>
                      )}
                   </div>
                </div>

                {/* Chicago Citation */}
                <div className={`space-y-3 p-4 ${themeStyles.bg} rounded-xl border ${themeStyles.border} transition-all hover:border-slate-600 group`}>
                   <div className="flex items-center justify-between">
                     <span className={`text-[10px] font-bold uppercase tracking-widest ${themeStyles.accentText}`}>Chicago (Author-Date)</span>
                     <button 
                      onClick={() => handleCopyCitation(citations?.chicago || '', 'chi')}
                      className="p-1.5 hover:bg-white/10 rounded transition-all opacity-0 group-hover:opacity-100"
                     >
                       {copiedId === 'chi' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-500" />}
                     </button>
                   </div>
                   <div className="min-h-[60px]">
                      {citations ? (
                        <p className="text-xs text-slate-300 leading-relaxed italic">{citations.chicago}</p>
                      ) : (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-2 bg-white/5 rounded w-full"></div>
                          <div className="h-2 bg-white/5 rounded w-3/4"></div>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-4 mb-12 text-center text-slate-500 text-xs shrink-0 flex items-center justify-center gap-4">
          <p>Efficiency First</p>
          <div className="w-1 h-1 bg-slate-800 rounded-full"></div>
          <p>Evelyn Wood Protocol</p>
          <div className="w-1 h-1 bg-slate-800 rounded-full"></div>
          <p>Spritz RSVP</p>
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
        body {
          margin: 0;
          overflow-x: hidden;
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid currentColor;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
};

export default App;
