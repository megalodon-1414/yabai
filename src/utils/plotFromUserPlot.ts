import type { UserPlotRow } from '../types/userPlot';
import { emotionPlotColor, rowToEmotionParams } from './emotionPlotBridge';
import { getEmotionPlotPosition } from './emotionPlotPosition';

export function plotColorFromRow(row: UserPlotRow): string {
  return emotionPlotColor(rowToEmotionParams(row));
}

export function plotPositionFromRow(row: UserPlotRow, time = 0): [number, number, number] {
  return getEmotionPlotPosition(rowToEmotionParams(row), row.word_id, time);
}

const NEARBY_PLOT_RADIUS = 2.5;

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

export function isPureEmotionPlot(row: UserPlotRow): boolean {
  return rowToEmotionParams(row).isPure;
}
