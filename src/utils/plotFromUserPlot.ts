import type { UserPlotRow } from '../types/userPlot';

export function plotColorFromRow(row: UserPlotRow): string {
  return `hsl(${row.hue}, ${row.saturation}%, ${row.brightness}%)`;
}

function brightnessToHeight(brightness: number): number {
  return ((brightness - 25) / 55) * 5;
}

const EMOTION_SATURATION_SCALE = 0.05;

export function emotionPositionFromParams(
  hue: number,
  saturation: number,
  brightness: number,
): [number, number, number] {
  const rad = (hue * Math.PI) / 180;
  const y = brightnessToHeight(brightness);
  const x = saturation * Math.cos(rad) * EMOTION_SATURATION_SCALE;
  const z = saturation * Math.sin(rad) * EMOTION_SATURATION_SCALE;
  return [x, y, z];
}

export function plotPositionFromRow(row: UserPlotRow): [number, number, number] {
  if (row.mode === 'emotion') {
    return emotionPositionFromParams(row.hue, row.saturation, row.brightness);
  }

  const perception = (row.hue / 360) * 20 - 10;
  const quality = (row.saturation / 100) * 10;
  const y = brightnessToHeight(row.brightness);
  return [perception * 0.5, y, quality * 0.5];
}

const NEARBY_PLOT_RADIUS = 1.2;

export function getNearbyPlotIds(
  plots: UserPlotRow[],
  selectedId: string,
  mode: string,
  radius = NEARBY_PLOT_RADIUS,
): Set<string> {
  const selected = plots.find((plot) => plot.word_id === selectedId && plot.mode === mode);
  if (!selected) {
    return new Set([selectedId]);
  }

  const [selectedX, selectedY, selectedZ] = plotPositionFromRow(selected);
  const nearby = new Set<string>();

  for (const plot of plots) {
    if (plot.mode !== mode) continue;

    const [x, y, z] = plotPositionFromRow(plot);
    const distance = Math.hypot(x - selectedX, y - selectedY, z - selectedZ);
    if (distance <= radius) {
      nearby.add(plot.word_id);
    }
  }

  return nearby;
}
