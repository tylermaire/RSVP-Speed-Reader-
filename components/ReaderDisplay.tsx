
import React from 'react';
import { Token, Theme } from '../types';

interface ReaderDisplayProps {
  token: Token | null;
  fontSize: number;
  theme: Theme;
}

const ReaderDisplay: React.FC<ReaderDisplayProps> = ({ token, fontSize, theme }) => {
  const themeColors = {
    dark: { bg: 'bg-slate-900', border: 'border-slate-700', guide: 'bg-red-500/20', focus: 'text-red-500', text: 'text-slate-100' },
    forest: { bg: 'bg-[#0d1a0f]', border: 'border-emerald-900/50', guide: 'bg-emerald-500/20', focus: 'text-emerald-400', text: 'text-emerald-50' },
    sea: { bg: 'bg-[#0a1a26]', border: 'border-sky-900/50', guide: 'bg-sky-500/20', focus: 'text-sky-400', text: 'text-sky-50' }
  }[theme];

  if (!token) {
    return (
      <div className={`flex items-center justify-center h-48 border-y ${themeColors.border} ${themeColors.bg} rounded-lg`}>
        <span className="text-slate-500 italic">Upload a file to start reading</span>
      </div>
    );
  }

  const word = token.text;
  const focusIdx = token.focusIndex;
  
  const prefix = word.substring(0, focusIdx);
  const focusLetter = word[focusIdx] || '';
  const suffix = word.substring(focusIdx + 1);

  return (
    <div className={`relative flex flex-col items-center justify-center h-64 border-y-2 ${themeColors.border} ${themeColors.bg} overflow-hidden select-none transition-colors duration-500`}>
      {/* Centering Crosshair Guides */}
      <div className={`absolute top-0 bottom-0 left-1/2 w-px ${themeColors.guide} pointer-events-none`}></div>
      <div className={`absolute top-1/2 left-0 right-0 h-px ${themeColors.guide} pointer-events-none`}></div>
      
      {/* RSVP Word Container */}
      <div 
        className={`mono font-bold flex transition-all duration-75 ${token.isQuote ? 'italic text-amber-400' : themeColors.text}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        <div className="flex w-full items-baseline justify-center">
           <span className="text-right inline-block" style={{ width: '45%' }}>{prefix}</span>
           <span className={`${themeColors.focus} text-center inline-block`} style={{ width: '10%' }}>{focusLetter}</span>
           <span className="text-left inline-block" style={{ width: '45%' }}>{suffix}</span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4">
        {token.isQuote && (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded border border-amber-500/30 font-medium uppercase tracking-wider">
            Quote Mode
          </span>
        )}
      </div>
    </div>
  );
};

export default ReaderDisplay;
