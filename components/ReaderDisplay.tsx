
import React from 'react';
import { Token, Theme } from '../types';

interface ReaderDisplayProps {
  token: Token | null;
  fontSize: number;
  theme: Theme;
}

const ReaderDisplay: React.FC<ReaderDisplayProps> = ({ token, fontSize, theme }) => {
  const themeColors = {
    dark: { bg: 'bg-slate-900', border: 'border-slate-700', guide: 'bg-pink-500/10', focus: 'text-pink-500', text: 'text-slate-100', glow: 'bg-blue-500' },
    forest: { bg: 'bg-[#0d1a0f]', border: 'border-emerald-900/50', guide: 'bg-emerald-500/20', focus: 'text-emerald-400', text: 'text-emerald-50', glow: 'bg-emerald-500' },
    sea: { bg: 'bg-[#0a1a26]', border: 'border-sky-900/50', guide: 'bg-sky-500/20', focus: 'text-sky-400', text: 'text-sky-50', glow: 'bg-sky-500' }
  }[theme];

  if (!token) {
    return (
      <div className={`flex items-center justify-center h-64 border-y-2 ${themeColors.border} ${themeColors.bg} rounded-xl shadow-inner`}>
        <span className="text-slate-500 italic font-medium">Upload a document to begin</span>
      </div>
    );
  }

  const word = token.text;
  const focusIdx = token.focusIndex;
  
  const prefix = word.substring(0, focusIdx);
  const focusLetter = word[focusIdx] || '';
  const suffix = word.substring(focusIdx + 1);

  return (
    <div className={`relative flex flex-col items-center justify-center h-64 border-y-2 ${themeColors.border} ${themeColors.bg} overflow-hidden select-none transition-colors duration-500 rounded-xl shadow-2xl`}>
      {/* Centering Crosshair Guides */}
      <div className={`absolute top-0 bottom-0 left-1/2 w-px ${themeColors.guide} pointer-events-none z-0`}></div>
      <div className={`absolute top-1/2 left-0 right-0 h-px ${themeColors.guide} pointer-events-none z-0`}></div>
      
      {/* RSVP Word Container using CSS Grid for perfect non-overlapping alignment */}
      <div 
        className={`mono font-bold grid grid-cols-[1fr_auto_1fr] w-full px-4 items-baseline transition-all duration-75 z-10 ${token.isQuote ? 'italic text-amber-400' : themeColors.text}`}
        style={{ fontSize: `${fontSize}px`, lineHeight: 1 }}
      >
        <div className="text-right whitespace-pre overflow-visible pr-[0.05em]">
          {prefix}
        </div>
        <div className="relative flex items-center justify-center">
          {/* Subtle focus highlight circle aligned with branding */}
          <div className={`absolute inset-0 scale-150 rounded-full opacity-10 ${themeColors.glow}`}></div>
          <span className={`${themeColors.focus} relative z-10 drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]`}>
            {focusLetter}
          </span>
        </div>
        <div className="text-left whitespace-pre overflow-visible pl-[0.05em]">
          {suffix}
        </div>
      </div>

      {/* Mode Indicators */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
        {token.isQuote && (
          <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 font-bold uppercase tracking-widest animate-pulse">
            Dialogue
          </span>
        )}
        {token.isPunctuation && (
          <span className="text-[10px] bg-slate-500/10 text-slate-500 px-2 py-0.5 rounded border border-slate-500/20 font-bold uppercase tracking-widest">
            Pause
          </span>
        )}
      </div>
    </div>
  );
};

export default ReaderDisplay;
