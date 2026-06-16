import type { UserPlotRow } from '../types/userPlot';

export function plotColorFromRow(row: UserPlotRow): string {
  return `hsl(${row.hue}, ${row.saturation}%, ${row.brightness}%)`;
}

function brightnessToHeight(brightness: number): number {
  return ((brightness - 25) / 55) * 5;
}

export function plotPositionFromRow(row: UserPlotRow): [number, number, number] {
  if (row.mode === 'emotion') {
    const rad = (row.hue * Math.PI) / 180;
    const y = brightnessToHeight(row.brightness);
    const x = row.saturation * Math.cos(rad) * 0.05;
    const z = row.saturation * Math.sin(rad) * 0.05;
    return [x, y, z];
  }

  const perception = (row.hue / 360) * 20 - 10;
  const quality = (row.saturation / 100) * 10;
  const y = brightnessToHeight(row.brightness);
  return [perception * 0.5, y, quality * 0.5];
}
