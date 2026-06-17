const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 16;
const FONT_SIZE_RATIO = 0.032;
const DISTANCE_FACTOR_RATIO = 0.56;
const SELECTED_FONT_SCALE = 1.15;

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
  const fontSize = isSelected ? Math.round(baseFontSize * SELECTED_FONT_SCALE) : baseFontSize;
  const sphereGap = Math.round(baseFontSize * 0.5 + 8);
  const screenOffsetY = isSelected ? Math.round(sphereGap * 1.35) : sphereGap;

  return {
    fontSize: `${fontSize}px`,
    distanceFactor: baseFontSize * DISTANCE_FACTOR_RATIO,
    screenOffsetY,
  };
}
