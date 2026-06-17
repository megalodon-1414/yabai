import { SELECTED_PLOT_SCALE } from './plotSelectionStyle';

const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 12;
const FONT_SIZE_RATIO = 0.024;
const DISTANCE_FACTOR_RATIO = 0.56;

export interface PlotLabelStyle {
  fontSize: string;
  distanceFactor: number;
  screenOffsetY: number;
}

export function getPlotLabelStyle(
  viewportWidth: number,
  viewportHeight: number,
  isSelected: boolean,
): PlotLabelStyle {
  const minDim = Math.min(viewportWidth, viewportHeight);
  const baseFontSize = Math.round(
    Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, minDim * FONT_SIZE_RATIO)),
  );
  const fontSize = isSelected ? Math.round(baseFontSize * SELECTED_PLOT_SCALE) : baseFontSize;
  const sphereGap = Math.round(baseFontSize * 0.45 + 5);
  const screenOffsetY = isSelected ? Math.round(sphereGap * SELECTED_PLOT_SCALE) : sphereGap;

  return {
    fontSize: `${fontSize}px`,
    distanceFactor: baseFontSize * DISTANCE_FACTOR_RATIO,
    screenOffsetY,
  };
}
