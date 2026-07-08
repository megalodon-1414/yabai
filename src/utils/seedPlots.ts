import { initialWords } from '../data/wordsData';
import type { UserPlotRow } from '../types/userPlot';
import { isEmotionWord } from './wordHelpers';
import { emotionWordToUserPlot } from './legacyEmotionBridge';

export function seedPlotsFromWordsData(): UserPlotRow[] {
  return initialWords.filter(isEmotionWord).map(emotionWordToUserPlot);
}

export function mergeWithSeedPlots(plots: UserPlotRow[]): UserPlotRow[] {
  if (plots.some((plot) => plot.mode === 'emotion')) {
    return plots;
  }
  return [...seedPlotsFromWordsData(), ...plots];
}
