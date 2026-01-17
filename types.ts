
export type Theme = 'dark' | 'forest' | 'sea';

export interface Token {
  text: string;
  isPunctuation: boolean;
  isQuote: boolean;
  focusIndex: number;
}

export interface ReadingState {
  currentWordIndex: number;
  isPlaying: boolean;
  wpm: number;
  text: string;
  tokens: Token[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}

export interface Quiz {
  title: string;
  questions: QuizQuestion[];
}

export interface Bookmark {
  id: string;
  index: number;
  percentage: number;
  timestamp: number;
  label: string;
}

export interface Citation {
  apa7: string;
  mla9: string;
  chicago: string;
}
