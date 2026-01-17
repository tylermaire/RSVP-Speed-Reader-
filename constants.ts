
export const DEFAULT_WPM = 300;
export const MIN_WPM = 50;
export const MAX_WPM = 1000;

export const getFocusIndex = (word: string): number => {
  const length = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").length;
  if (length <= 1) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return 4;
};

export const tokenize = (text: string): any[] => {
  const rawTokens = text.trim().split(/\s+/);
  let inQuotes = false;

  return rawTokens.map((token) => {
    const endsWithPunc = /[.,;!?]$/.test(token);
    
    // Check for quote toggles
    const hasOpeningQuote = token.startsWith('"') || token.startsWith("'");
    const hasClosingQuote = token.endsWith('"') || token.endsWith("'");
    
    if (hasOpeningQuote && !hasClosingQuote) inQuotes = true;
    const currentIsQuoted = inQuotes || hasOpeningQuote || hasClosingQuote;
    if (hasClosingQuote) inQuotes = false;

    return {
      text: token,
      isPunctuation: endsWithPunc,
      isQuote: currentIsQuoted,
      focusIndex: getFocusIndex(token)
    };
  });
};
