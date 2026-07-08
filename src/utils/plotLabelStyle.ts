import { SELECTED_PLOT_SCALE } from './plotSelectionStyle';
import type { UserPlotRow } from '../types/userPlot';
import { EMOTION_INTENSITY_MAX, isPurePlot } from '../utils/emotionPlotBridge';

const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 9;
const FONT_SIZE_RATIO = 0.017;
const DISTANCE_FACTOR_RATIO = 0.5;
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
  selectedScale = SELECTED_PLOT_SCALE,
): PlotLabelStyle {
  const minDim = Math.min(viewportWidth, viewportHeight);
  const baseFontSize = Math.round(
    Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, minDim * FONT_SIZE_RATIO)),
  );
  const fontSize = isSelected ? Math.round(baseFontSize * selectedScale) : baseFontSize;
  const sphereGap = Math.round(baseFontSize * 0.4 + 4);
  const screenOffsetY = isSelected ? Math.round(sphereGap * selectedScale) : sphereGap;

  return {
    fontSize: `${fontSize}px`,
    distanceFactor: baseFontSize * DISTANCE_FACTOR_RATIO,
    screenOffsetY,
  };
}

export function getPlotLabelTypography(plot: UserPlotRow, isSelected: boolean): PlotLabelTypography {
  const pure = isPurePlot(plot);
  const intensityNorm = plot.intensity / EMOTION_INTENSITY_MAX;
  const selectedWeightBoost = isSelected ? 80 : 0;
  const fontWeight = Math.round(
    Math.min(
      FONT_WEIGHT_MAX,
      FONT_WEIGHT_MIN + intensityNorm * (FONT_WEIGHT_MAX - FONT_WEIGHT_MIN) + selectedWeightBoost,
    ),
  );
  const fontWidth = Math.round(
    pure ? FONT_WIDTH_MIN + 20 : FONT_WIDTH_MIN + intensityNorm * (FONT_WIDTH_MAX - FONT_WIDTH_MIN),
  );

  return {
    fontWeight,
    fontVariationSettings: `"ital" 0, "wdth" ${fontWidth}, "wght" ${fontWeight}`,
  };
}
