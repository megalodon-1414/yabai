import type { UserPlotRow } from '../types/userPlot';
import { emotionColorFromVector } from '../emotionSpace/plotColor';
import { emotionPositionFromVector } from '../emotionSpace/plotPosition';

export function plotColorFromRow(row: UserPlotRow): string {
  return emotionColorFromVector(row.emotions);
}

export function plotPositionFromRow(row: UserPlotRow): [number, number, number] {
  return emotionPositionFromVector(row.emotions);
}

const NEARBY_PLOT_RADIUS = 0.75;

export function getNearbyPlotIds(
  plots: UserPlotRow[],
  selectedId: string,
  radius = NEARBY_PLOT_RADIUS,
): Set<string> {
  const selected = plots.find((plot) => plot.word_id === selectedId);
  if (!selected) {
    return new Set([selectedId]);
  }

  const [selectedX, selectedY, selectedZ] = plotPositionFromRow(selected);
  const nearby = new Set<string>();

  for (const plot of plots) {
    const [x, y, z] = plotPositionFromRow(plot);
    const distance = Math.hypot(x - selectedX, y - selectedY, z - selectedZ);
    if (distance <= radius) {
      nearby.add(plot.word_id);
    }
  }

  return nearby;
}
