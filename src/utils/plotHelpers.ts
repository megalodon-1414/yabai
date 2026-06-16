import type { UserPlotRow } from '../types/userPlot';

export type PlotMode = 'emotion' | 'state';

export function createDefaultPlot(mode: PlotMode): UserPlotRow {
  return {
    word_id: `${mode[0]}-${Date.now()}`,
    mode,
    hue: mode === 'emotion' ? 0 : 180,
    brightness: 52.5,
    saturation: 50,
  };
}

export function getPlotsForMode(plots: UserPlotRow[], mode: PlotMode): UserPlotRow[] {
  return plots.filter((plot) => plot.mode === mode);
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
