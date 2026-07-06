import { SELECTED_PLOT_SCALE } from './plotSelectionStyle';
import type { UserPlotRow } from '../types/userPlot';
import { getEmotionDominance, getPlotSpread } from '../emotionSpace/plotColor';

const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 12;
const FONT_SIZE_RATIO = 0.024;
const DISTANCE_FACTOR_RATIO = 0.56;
const FONT_WEIGHT_MIN = 200;
const FONT_WEIGHT_MAX = 900;
const FONT_WIDTH_MIN = 50;
const FONT_WIDTH_MAX = 150;

export interface PlotLabelStyle {
  fontSize: string;
  distanceFactor: number;
  screenOffsetY: number;
}

export interface PlotLabelTypography {
  fontWeight: number;
  fontVariationSettings: string;
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

export function getPlotLabelTypography(plot: UserPlotRow, isSelected: boolean): PlotLabelTypography {
  const dominance = getEmotionDominance(plot.emotions);
  const spread = getPlotSpread(plot.emotions);
  const selectedWeightBoost = isSelected ? 80 : 0;
  const fontWeight = Math.round(
    Math.min(FONT_WEIGHT_MAX, FONT_WEIGHT_MIN + dominance * (FONT_WEIGHT_MAX - FONT_WEIGHT_MIN) + selectedWeightBoost),
  );
  const fontWidth = Math.round(FONT_WIDTH_MIN + spread * (FONT_WIDTH_MAX - FONT_WIDTH_MIN));

  return {
    fontWeight,
    fontVariationSettings: `"ital" 0, "wdth" ${fontWidth}, "wght" ${fontWeight}`,
  };
}
