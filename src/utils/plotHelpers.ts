import type { UserPlotRow } from '../types/userPlot';
import { createDefaultEmotionVector } from '../emotionSpace/migrate';

export function createDefaultPlot(): UserPlotRow {
  return {
    word_id: `w-${Date.now()}`,
    emotions: createDefaultEmotionVector(),
  };
}

export function updatePlot(plots: UserPlotRow[], updated: UserPlotRow): UserPlotRow[] {
  return plots.map((plot) => (plot.word_id === updated.word_id ? updated : plot));
}

export function replacePlotId(
  plots: UserPlotRow[],
  previousId: string,
  updated: UserPlotRow,
): UserPlotRow[] {
  return plots.map((plot) => (plot.word_id === previousId ? updated : plot));
}

export function removePlotById(plots: UserPlotRow[], wordId: string): UserPlotRow[] {
  return plots.filter((plot) => plot.word_id !== wordId);
}
