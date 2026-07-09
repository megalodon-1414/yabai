const BASE_MIN_DIM = 900;
const MIN_SCALE = 0.68;
const MAX_SCALE = 1.2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scaleValue(value: number, scale: number): number {
  return Math.round(value * scale);
}

function scaleRem(value: number, scale: number): string {
  return `${(value * scale).toFixed(3)}rem`;
}

export interface ExplorationInfoUiLayout {
  scale: number;
  uiGroupLeftPercent: number;
  nextWordPanel: {
    x: number;
    y: number;
    width: number;
    collapsedHeight: number;
    expandedHeight: number;
    padding: number;
    borderRadius: number;
    headerHeight: number;
    headerGap: number;
    tickerHeight: number;
    tickerFontSize: string;
    wordFontSize: string;
    subLabelFontSize: string;
    contentMarginTop: number;
    contentGap: number;
    arrowBorderY: number;
    arrowBorderX: number;
    guideAnchorX: number;
    guideAnchorY: number;
    contentMaxHeight: number;
  };
  currentWordPanel: {
    x: number;
    y: number;
    width: number;
    height: number;
    paddingX: number;
    paddingY: number;
    borderRadius: number;
    gap: number;
    innerGap: number;
    innerMinHeight: number;
    wordColumnWidth: number;
    tickerHeight: number;
    tickerFontSize: string;
    sectionLabelFontSize: string;
    wordFontSize: string;
    bodyFontSize: string;
    dlFontSize: string;
    metaFontSize: string;
    bodyMaxHeight: number;
    intensityBarWidth: number;
    intensityBarHeight: number;
    columnGap: number;
    rowGap: number;
    paddingLeft: number;
    arrowBorder: number;
  };
}

export function getExplorationInfoUiLayout(
  viewportWidth: number,
  viewportHeight: number,
  nextWordLabelLength = 0,
): ExplorationInfoUiLayout {
  const minDim = Math.min(viewportWidth, viewportHeight);
  const scale = clamp(minDim / BASE_MIN_DIM, MIN_SCALE, MAX_SCALE);
  const s = (value: number) => scaleValue(value, scale);

  const uiGroupLeftPercent = 48;
  const uiGroupLeft = viewportWidth * (uiGroupLeftPercent / 100);
  const uiGroupTop = Math.max(s(16), viewportHeight * 0.5 - s(180));
  const panelGap = s(24);

  const nextWordWidth = s(80);
  const nextCollapsedHeight = s(42);
  const nextExpandedBase = s(132);
  const nextExpandedMax = s(260);
  const nextExpandedHeight = clamp(
    s(56 + nextWordLabelLength * 18),
    nextExpandedBase,
    nextExpandedMax,
  );

  const currentWordWidth = s(300);
  const currentWordHeight = s(360);

  return {
    scale,
    uiGroupLeftPercent,
    nextWordPanel: {
      x: uiGroupLeft,
      y: uiGroupTop,
      width: nextWordWidth,
      collapsedHeight: nextCollapsedHeight,
      expandedHeight: nextExpandedHeight,
      padding: s(10),
      borderRadius: s(12),
      headerHeight: s(22),
      headerGap: s(8),
      tickerHeight: s(18),
      tickerFontSize: scaleRem(0.72, scale),
      wordFontSize: scaleRem(1.02, scale),
      subLabelFontSize: scaleRem(0.68, scale),
      contentMarginTop: s(14),
      contentGap: s(12),
      arrowBorderY: s(5),
      arrowBorderX: s(9),
      guideAnchorX: nextWordWidth - s(12),
      guideAnchorY: s(22),
      contentMaxHeight: nextExpandedHeight - s(52),
    },
    currentWordPanel: {
      x: uiGroupLeft + nextWordWidth + panelGap,
      y: uiGroupTop,
      width: currentWordWidth,
      height: currentWordHeight,
      paddingX: s(16),
      paddingY: s(18),
      borderRadius: s(10),
      gap: s(18),
      innerGap: s(12),
      innerMinHeight: s(324),
      wordColumnWidth: s(50),
      tickerHeight: s(18),
      tickerFontSize: scaleRem(0.68, scale),
      sectionLabelFontSize: scaleRem(0.68, scale),
      wordFontSize: scaleRem(2.25, scale),
      bodyFontSize: scaleRem(0.92, scale),
      dlFontSize: scaleRem(0.84, scale),
      metaFontSize: scaleRem(0.68, scale),
      bodyMaxHeight: s(320),
      intensityBarWidth: s(8),
      intensityBarHeight: s(160),
      columnGap: s(14),
      rowGap: s(8),
      paddingLeft: s(14),
      arrowBorder: s(5),
    },
  };
}
