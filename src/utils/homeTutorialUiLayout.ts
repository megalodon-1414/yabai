import type { ExplorationInfoUiLayout } from './explorationInfoUiLayout';

/**
 * UIパネルの右端マージン（大きくするほどパネルが左＝中央へ寄る）
 * - RIGHT_MARGIN_RATIO: 画面幅に対する割合（例 0.12 = 12%）
 * - RIGHT_MARGIN_MIN: 狭い画面での最低マージン（px ベース、スケール前の値）
 */
const HOME_TUTORIAL_UI_RIGHT_MARGIN_RATIO = 0.2;
const HOME_TUTORIAL_UI_RIGHT_MARGIN_MIN = 56;

/**
 * UI全体のスケール（大きく見せたいとき）
 * - HOME_BASE_MIN_DIM を小さくする → 全体が大きくなる（逆比例）
 * - HOME_MAX_SCALE を大きくする → 大画面での上限が上がる
 * - 下の currentWordWidth などベース寸法を大きくする → パネル・文字の素のサイズが増える
 */
const HOME_BASE_MIN_DIM = 600;
const HOME_MIN_SCALE = 0.82;
const HOME_MAX_SCALE = 2.0;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scaleValue(value: number, scale: number): number {
  return Math.round(value * scale);
}

function scaleRem(value: number, scale: number): string {
  return `${(value * scale).toFixed(3)}rem`;
}

export function getHomeTutorialUiLayout(
  viewportWidth: number,
  viewportHeight: number,
): Pick<ExplorationInfoUiLayout, 'scale' | 'currentWordPanel'> {
  const minDim = Math.min(viewportWidth, viewportHeight);
  const scale = clamp(minDim / HOME_BASE_MIN_DIM, HOME_MIN_SCALE, HOME_MAX_SCALE);
  const s = (value: number) => scaleValue(value, scale);

  const uiGroupRightMargin = Math.max(
    s(HOME_TUTORIAL_UI_RIGHT_MARGIN_MIN),
    viewportWidth * HOME_TUTORIAL_UI_RIGHT_MARGIN_RATIO,
  );
  const currentWordWidth = s(340);
  const currentWordHeight = s(410);
  const currentWordX = viewportWidth - currentWordWidth - uiGroupRightMargin;
  const uiGroupTop = Math.max(s(16), viewportHeight * 0.42 - currentWordHeight / 2);

  return {
    scale,
    currentWordPanel: {
      x: currentWordX,
      y: uiGroupTop,
      width: currentWordWidth,
      height: currentWordHeight,
      paddingX: s(16),
      paddingY: s(18),
      borderRadius: s(10),
      gap: s(18),
      innerGap: s(12),
      innerMinHeight: s(380),
      wordColumnWidth: s(56),
      tickerHeight: s(20),
      tickerFontSize: scaleRem(0.72, scale),
      sectionLabelFontSize: scaleRem(0.72, scale),
      wordFontSize: scaleRem(2.5, scale),
      bodyFontSize: scaleRem(1.0, scale),
      dlFontSize: scaleRem(0.9, scale),
      metaFontSize: scaleRem(0.75, scale),
      bodyMaxHeight: s(380),
      intensityBarWidth: s(8),
      intensityBarHeight: s(160),
      columnGap: s(14),
      rowGap: s(8),
      paddingLeft: s(14),
      arrowBorder: s(5),
    },
  };
}
