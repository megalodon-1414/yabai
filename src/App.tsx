import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SpaceCanvas } from './components/SpaceCanvas';
import { EmotionMinimap, MAP_WIDTH } from './components/EmotionMinimap';
import { ExplorationToolsPanel } from './components/ExplorationToolsPanel';
import { WordEditor } from './components/WordEditor';
import { getEmotionById } from './data/emotions';
import { usePlotSubmit } from './hooks/usePlotSubmit';
import { fetchEmotionWordsAsPlots } from './services/emotionWords';
import type { UserPlotRow } from './types/userPlot';
import {
  removePlotById,
  replacePlotId,
  updatePlot,
} from './utils/plotHelpers';
import { isExplorationDummyPlot, mergeExplorationDummyPlots } from './utils/explorationDummyPlots';
import { EMOTION_INTENSITY_MAX } from './utils/emotionPlotBridge';
import { pickRandomPlotId } from './utils/explorationMode';
import { type AppBackgroundTheme } from './utils/appBackgroundTheme';
import { FLOW_LABEL_DURATION_MS, type PlotLabelDisplayMode } from './utils/plotLabelStyle';
import { getExplorationInfoUiLayout } from './utils/explorationInfoUiLayout';
import type { MinimapSyncState } from './utils/emotionMinimapLayout';
import { getPrimaryEmotionColor } from './utils/emotionPlotBridge';
import { DEFAULT_EMOTION_UI_ACCENT, getEmotionUiTheme } from './utils/emotionUiTheme';
import { filterPlotsByTags, getPlotKindLabel, type PlotTagId } from './utils/plotTags';
import { mergeWithSeedPlots } from './utils/seedPlots';

const UI_COLOR_TRANSITION =
  'border-color 320ms ease, background-color 320ms ease, color 320ms ease, box-shadow 320ms ease';

function pickPreferredPlotId(plots: UserPlotRow[]): string | null {
  const registered = plots.filter((plot) => !isExplorationDummyPlot(plot.word_id));
  return pickRandomPlotId(registered.length > 0 ? registered : plots);
}

function App() {
  const mainRef = useRef<HTMLElement>(null);
  const [plots, setPlots] = useState<UserPlotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedScreenPoint, setSelectedScreenPoint] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [hoveredWordId, setHoveredWordId] = useState<string | null>(null);
  const [flowLabelExpiresAt, setFlowLabelExpiresAt] = useState<Record<string, number>>({});
  const [flowLabelNow, setFlowLabelNow] = useState(() => Date.now());
  const [hoveredWarpGateLabel, setHoveredWarpGateLabel] = useState<string | null>(null);
  const [hoveredScreenPoint, setHoveredScreenPoint] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [mainSize, setMainSize] = useState({ width: 0, height: 0 });
  const [infoPanelWordId, setInfoPanelWordId] = useState<string | null>(null);
  const [isInfoPanelVisible, setIsInfoPanelVisible] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [plotLabelDisplayMode, setPlotLabelDisplayMode] = useState<PlotLabelDisplayMode>('flow');
  const [backgroundTheme, setBackgroundTheme] = useState<AppBackgroundTheme>('dark');
  const [minimapSync, setMinimapSync] = useState<MinimapSyncState | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<PlotTagId>>(() => new Set());
  const [isExplorationMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { plotStatus } = usePlotSubmit();

  const togglePlotLabelDisplayMode = useCallback(() => {
    setPlotLabelDisplayMode((mode) => (mode === 'flow' ? 'nearby' : 'flow'));
  }, []);

  const toggleBackgroundTheme = useCallback(() => {
    setBackgroundTheme((theme) => (theme === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'l') {
        event.preventDefault();
        togglePlotLabelDisplayMode();
        return;
      }
      if (key === 'b') {
        event.preventDefault();
        toggleBackgroundTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleBackgroundTheme, togglePlotLabelDisplayMode]);

  const loadPlots = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchEmotionWordsAsPlots();
      if (data.length === 0) {
        console.warn('[emotion_words] fetched 0 rows; falling back to local seeds');
      } else {
        console.info(`[emotion_words] loaded ${data.length} words from Supabase`);
      }
      setPlots(mergeWithSeedPlots(data));
      setSelectedId((prev) => {
        if (prev && data.some((plot) => plot.word_id === prev)) return prev;
        return pickPreferredPlotId(data);
      });
    } catch (error) {
      console.error('Supabase load failed:', error);
      setLoadError(error instanceof Error ? error.message : 'データの読み込みに失敗しました');
      setPlots([]);
      setSelectedId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlots();
  }, [loadPlots]);

  useEffect(() => {
    const element = mainRef.current;
    if (!element) return;

    const updateSize = () => {
      setMainSize({ width: element.clientWidth, height: element.clientHeight });
    };
    const observer = new ResizeObserver(updateSize);
    updateSize();
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const hasEmotionWords = useMemo(
    () => plots.some((plot) => plot.sourceId != null),
    [plots],
  );

  const displayPlots = useMemo(
    () => mergeExplorationDummyPlots(plots, isExplorationMode && !hasEmotionWords),
    [plots, isExplorationMode, hasEmotionWords],
  );

  const visiblePlots = useMemo(
    () => filterPlotsByTags(displayPlots, selectedTagIds),
    [displayPlots, selectedTagIds],
  );

  useEffect(() => {
    if (selectedId) return;
    if (!isExplorationMode && plots[0]) {
      setSelectedId(plots[0].word_id);
    }
  }, [plots, selectedId, isExplorationMode]);

  useEffect(() => {
    if (!isExplorationMode || isLoading) return;
    if (visiblePlots.length === 0) return;

    setSelectedId((prev) => {
      if (prev && visiblePlots.some((plot) => plot.word_id === prev)) {
        return prev;
      }
      return pickPreferredPlotId(visiblePlots);
    });
  }, [isExplorationMode, isLoading, visiblePlots]);

  const infoPanelPlot = useMemo(
    () => displayPlots.find((plot) => plot.word_id === infoPanelWordId) ?? null,
    [displayPlots, infoPanelWordId],
  );

  const selectedPlot = useMemo(
    () => displayPlots.find((plot) => plot.word_id === selectedId) ?? null,
    [displayPlots, selectedId],
  );

  const emotionUiTheme = useMemo(() => {
    const accent = selectedPlot
      ? getPrimaryEmotionColor(selectedPlot.primaryId)
      : DEFAULT_EMOTION_UI_ACCENT;
    return getEmotionUiTheme(accent, backgroundTheme);
  }, [selectedPlot, backgroundTheme]);

  const hoveredPlot = useMemo(
    () =>
      !hoveredWarpGateLabel && hoveredWordId && hoveredWordId !== selectedId
        ? displayPlots.find((plot) => plot.word_id === hoveredWordId) ?? null
        : null,
    [displayPlots, hoveredWarpGateLabel, hoveredWordId, selectedId],
  );
  const nextWordLabel = hoveredWarpGateLabel ?? hoveredPlot?.word_id ?? '';

  useEffect(() => {
    if (!isExplorationMode || !selectedId) {
      setIsInfoPanelVisible(false);
      return;
    }

    if (infoPanelWordId === selectedId) {
      setIsInfoPanelVisible(true);
      return;
    }

    if (!infoPanelWordId) {
      setInfoPanelWordId(selectedId);
      setIsInfoPanelVisible(true);
      return;
    }

    setIsInfoPanelVisible(false);
    const timeoutId = window.setTimeout(() => {
      setInfoPanelWordId(selectedId);
      setIsInfoPanelVisible(true);
    }, 130);

    return () => window.clearTimeout(timeoutId);
  }, [infoPanelWordId, isExplorationMode, selectedId]);

  const handlePlotChange = (updated: UserPlotRow, previousId?: string) => {
    if (isExplorationDummyPlot(updated.word_id)) {
      return;
    }
    if (previousId && previousId !== updated.word_id) {
      setPlots((prev) => replacePlotId(prev, previousId, updated));
      setSelectedId(updated.word_id);
      return;
    }

    setPlots((prev) => updatePlot(prev, updated));
  };

  const handlePlotAdd = (plot: UserPlotRow) => {
    setPlots((prev) => [...prev, plot]);
  };

  const handleWordSelect = (id: string) => {
    setSelectedId(id);
    if (!isExplorationMode && !isExplorationDummyPlot(id)) {
      setIsEditorOpen(true);
    }
  };

  const handleToggleTag = useCallback((tagId: PlotTagId) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  const handleStartSearchGame = useCallback(() => {
    // サーチゲーム本体は今後実装。UIのスタート導線のみ用意する。
  }, []);

  const handlePlotDelete = (id: string) => {
    if (isExplorationDummyPlot(id)) {
      return;
    }
    setPlots((prev) => removePlotById(prev, id));
    setSelectedId((prev) => (prev === id ? null : prev));
  };

  const handleSelectedScreenPosition = useCallback(
    (point: { x: number; y: number; visible: boolean } | null) => {
      setSelectedScreenPoint(point);
    },
    [],
  );

  const handleHoveredScreenPosition = useCallback(
    (point: { x: number; y: number; visible: boolean } | null) => {
      setHoveredScreenPoint(point);
    },
    [],
  );

  const handleMinimapSync = useCallback((state: MinimapSyncState | null) => {
    setMinimapSync(state);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setFlowLabelNow(Date.now());
    }, 100);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleHoveredWordChange = useCallback((wordId: string | null) => {
    setHoveredWordId(wordId);
    if (wordId) {
      setHoveredWarpGateLabel(null);
      setFlowLabelExpiresAt((prev) => ({
        ...prev,
        [wordId]: Date.now() + FLOW_LABEL_DURATION_MS,
      }));
    }
  }, [FLOW_LABEL_DURATION_MS]);

  const handleHoveredWarpGateChange = useCallback((label: string | null) => {
    setHoveredWarpGateLabel(label);
    if (label) {
      setHoveredWordId(null);
    }
  }, []);

  const showInfoGuideLine =
    isExplorationMode &&
    isInfoPanelVisible &&
    infoPanelPlot &&
    selectedScreenPoint &&
    mainSize.width > 0 &&
    mainSize.height > 0;
  const nextWordLabelLength = Array.from(nextWordLabel).length;
  const infoUi = useMemo(
    () => getExplorationInfoUiLayout(mainSize.width, mainSize.height, nextWordLabelLength),
    [mainSize.width, mainSize.height, nextWordLabelLength],
  );
  const { nextWordPanel, currentWordPanel } = infoUi;
  const showHoverGuide =
    isExplorationMode &&
    isInfoPanelVisible &&
    nextWordLabel &&
    hoveredScreenPoint &&
    mainSize.width > 0 &&
    mainSize.height > 0;


  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: emotionUiTheme.uiText, backgroundColor: emotionUiTheme.shell, overflow: 'hidden', transition: UI_COLOR_TRANSITION }}>
      <style>
        {`
          @keyframes nextWordArrowPulse {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(-4px); }
          }
          @keyframes nextWordTicker {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-120%); }
          }
          @keyframes currentWordArrowPulse {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(-4px); }
          }
        `}
      </style>
      <main ref={mainRef} style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loadError && (
          <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 2, padding: '10px 16px', backgroundColor: 'rgba(255,0,85,0.15)', border: '1px solid #ff0055', borderRadius: '8px', fontSize: '0.9rem' }}>
            {loadError}
          </div>
        )}

        <SpaceCanvas
          plots={visiblePlots}
          selectedId={selectedId}
          explorationMode={isExplorationMode}
          flowLabelExpiresAt={flowLabelExpiresAt}
          flowLabelNow={flowLabelNow}
          plotLabelDisplayMode={plotLabelDisplayMode}
          backgroundTheme={backgroundTheme}
          emotionUiTheme={emotionUiTheme}
          onSelectedScreenPosition={handleSelectedScreenPosition}
          onHoveredWordChange={handleHoveredWordChange}
          onHoveredWarpGateChange={handleHoveredWarpGateChange}
          onHoveredScreenPosition={handleHoveredScreenPosition}
          onMinimapSync={handleMinimapSync}
          onWordSelect={handleWordSelect}
        />

        {isExplorationMode && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: `${MAP_WIDTH}px`,
            }}
          >
            <EmotionMinimap syncState={minimapSync} uiTheme={emotionUiTheme} />
            <ExplorationToolsPanel
              width={MAP_WIDTH}
              uiTheme={emotionUiTheme}
              plots={visiblePlots}
              selectedTagIds={selectedTagIds}
              onToggleTag={handleToggleTag}
              onSelectWord={handleWordSelect}
              onStartSearchGame={handleStartSearchGame}
            />
          </div>
        )}

        {isExplorationMode && (
          <div
            style={{
              position: 'absolute',
              right: '16px',
              bottom: '16px',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <button
              type="button"
              onClick={toggleBackgroundTheme}
              style={{
                padding: '8px 12px',
                border: `1px solid ${emotionUiTheme.controlBorder}`,
                borderRadius: '8px',
                backgroundColor: emotionUiTheme.controlBackground,
                color: emotionUiTheme.controlText,
                fontSize: '0.78rem',
                letterSpacing: '0.06em',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                transition: UI_COLOR_TRANSITION,
              }}
            >
              背景: {backgroundTheme === 'dark' ? '黒' : '薄灰'}（B）
            </button>
            <button
              type="button"
              onClick={togglePlotLabelDisplayMode}
              style={{
                padding: '8px 12px',
                border: `1px solid ${emotionUiTheme.controlBorder}`,
                borderRadius: '8px',
                backgroundColor: emotionUiTheme.controlBackground,
                color: emotionUiTheme.controlText,
                fontSize: '0.78rem',
                letterSpacing: '0.06em',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                transition: UI_COLOR_TRANSITION,
              }}
            >
              ラベル: {plotLabelDisplayMode === 'nearby' ? '常時' : 'フロー'}（L）
            </button>
          </div>
        )}

        {(showInfoGuideLine || showHoverGuide) && (
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${mainSize.width} ${mainSize.height}`}
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            {showInfoGuideLine && selectedScreenPoint && (
              <line
                x1={selectedScreenPoint.x}
                y1={selectedScreenPoint.y}
                x2={currentWordPanel.x}
                y2={currentWordPanel.y + currentWordPanel.height / 2}
                stroke={emotionUiTheme.guideLine}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {showHoverGuide && hoveredScreenPoint && (
              <line
                x1={hoveredScreenPoint.x}
                y1={hoveredScreenPoint.y}
                x2={nextWordPanel.x + nextWordPanel.guideAnchorX}
                y2={nextWordPanel.y + nextWordPanel.guideAnchorY}
                stroke={emotionUiTheme.guideLineHover}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}

        {isExplorationMode && infoPanelPlot && (
          <div
            style={{
              position: 'absolute',
              left: `${nextWordPanel.x}px`,
              top: `${nextWordPanel.y}px`,
              zIndex: 2,
              width: `${nextWordPanel.width}px`,
              height: `${nextWordLabel ? nextWordPanel.expandedHeight : nextWordPanel.collapsedHeight}px`,
              padding: `${nextWordPanel.padding}px`,
              border: `1px solid ${emotionUiTheme.accentBorder}`,
              borderLeft: `3px solid ${emotionUiTheme.accentBorderStrong}`,
              borderRadius: `${nextWordPanel.borderRadius}px`,
              backgroundColor: emotionUiTheme.panelBackground,
              boxShadow: emotionUiTheme.panelShadow,
              backdropFilter: 'blur(12px)',
              color: emotionUiTheme.textPrimary,
              opacity: isInfoPanelVisible ? 1 : 0,
              overflow: 'hidden',
              transition: `opacity 150ms ease, height 160ms ease, ${UI_COLOR_TRANSITION}`,
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: `${nextWordPanel.headerGap}px`, height: `${nextWordPanel.headerHeight}px` }}>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: `${nextWordPanel.tickerHeight}px`,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <p
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    margin: 0,
                    fontSize: nextWordPanel.tickerFontSize,
                    letterSpacing: '0.14em',
                    lineHeight: `${nextWordPanel.tickerHeight}px`,
                    color: emotionUiTheme.accentMuted,
                    whiteSpace: 'nowrap',
                    animation: 'nextWordTicker 3.8s linear infinite',
                  }}
                >
                  NEXT WORD
                </p>
              </div>
              <span
                style={{
                  display: 'block',
                  width: 0,
                  height: 0,
                  borderTop: `${nextWordPanel.arrowBorderY}px solid transparent`,
                  borderBottom: `${nextWordPanel.arrowBorderY}px solid transparent`,
                  borderRight: `${nextWordPanel.arrowBorderX}px solid ${emotionUiTheme.accentMuted}`,
                  opacity: nextWordLabel ? 1 : 0.45,
                  animation: nextWordLabel ? 'nextWordArrowPulse 900ms ease-in-out infinite' : 'none',
                  transition: 'opacity 160ms ease',
                }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `1fr ${nextWordPanel.tickerHeight}px`,
                gap: `${nextWordPanel.contentGap}px`,
                alignItems: 'start',
                justifyItems: 'center',
                marginTop: `${nextWordPanel.contentMarginTop}px`,
                opacity: nextWordLabel ? 1 : 0,
                transform: nextWordLabel ? 'translateY(0)' : 'translateY(-6px)',
                transition: 'opacity 140ms ease, transform 160ms ease',
              }}
            >
              <div
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  fontSize: nextWordPanel.wordFontSize,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  letterSpacing: '0.06em',
                  color: emotionUiTheme.textPrimary,
                  overflow: 'hidden',
                  maxHeight: `${nextWordPanel.contentMaxHeight}px`,
                }}
              >
                {nextWordLabel}
              </div>
              <p
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  margin: 0,
                  fontSize: nextWordPanel.subLabelFontSize,
                  letterSpacing: '0.12em',
                  lineHeight: 1.2,
                  color: emotionUiTheme.accentMuted,
                  whiteSpace: 'nowrap',
                }}
              >
                次の語
              </p>
            </div>
          </div>
        )}

        {isEditorOpen && !isExplorationMode && (
          <WordEditor
            plots={plots}
            selectedId={selectedId}
            plotStatus={plotStatus}
            onSelect={handleWordSelect}
            onChange={handlePlotChange}
            onAdd={handlePlotAdd}
            onDelete={handlePlotDelete}
          />
        )}

        {!isEditorOpen && !isExplorationMode && (
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              padding: '10px 16px',
              border: '1px solid #1f2833',
              borderRadius: '8px',
              backgroundColor: 'rgba(11, 12, 16, 0.92)',
              color: '#45f3ff',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            単語エディタを開く
          </button>
        )}

        {isExplorationMode && infoPanelPlot && (
          <aside
            style={{
              position: 'absolute',
              top: `${currentWordPanel.y}px`,
              left: `${currentWordPanel.x}px`,
              width: `${currentWordPanel.width}px`,
              minHeight: `${currentWordPanel.height}px`,
              zIndex: 2,
              padding: `${currentWordPanel.paddingY}px ${currentWordPanel.paddingX}px`,
              border: `1px solid ${emotionUiTheme.accentBorder}`,
              borderLeft: `4px solid ${emotionUiTheme.accentBorderStrong}`,
              borderRadius: `${currentWordPanel.borderRadius}px`,
              backgroundColor: emotionUiTheme.panelBackground,
              boxShadow: emotionUiTheme.panelShadow,
              backdropFilter: 'blur(12px)',
              color: emotionUiTheme.textPrimary,
              pointerEvents: 'none',
              opacity: isInfoPanelVisible ? 1 : 0,
              transition: `opacity 150ms ease, ${UI_COLOR_TRANSITION}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row-reverse',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                gap: `${currentWordPanel.gap}px`,
                height: '100%',
                minHeight: `${currentWordPanel.innerMinHeight}px`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row-reverse',
                  alignItems: 'flex-start',
                  gap: `${currentWordPanel.innerGap}px`,
                  paddingLeft: `${currentWordPanel.paddingLeft}px`,
                  borderLeft: `1px solid ${emotionUiTheme.divider}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: `${currentWordPanel.innerGap}px`,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: 0,
                      height: 0,
                      borderTop: `${currentWordPanel.arrowBorder}px solid transparent`,
                      borderBottom: `${currentWordPanel.arrowBorder}px solid transparent`,
                      borderRight: `${currentWordPanel.arrowBorder + 4}px solid ${emotionUiTheme.accentMuted}`,
                      animation: 'currentWordArrowPulse 900ms ease-in-out infinite',
                    }}
                  />
                  <p
                    style={{
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      margin: 0,
                      fontSize: currentWordPanel.sectionLabelFontSize,
                      letterSpacing: '0.18em',
                      color: emotionUiTheme.accentMuted,
                    }}
                  >
                    現在の語
                  </p>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: `${currentWordPanel.innerGap}px`,
                    width: `${currentWordPanel.wordColumnWidth}px`,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${currentWordPanel.wordColumnWidth}px`,
                      height: `${currentWordPanel.tickerHeight}px`,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <p
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        margin: 0,
                        fontSize: currentWordPanel.tickerFontSize,
                        letterSpacing: '0.14em',
                        lineHeight: `${currentWordPanel.tickerHeight}px`,
                        color: emotionUiTheme.accentMuted,
                        whiteSpace: 'nowrap',
                        animation: 'nextWordTicker 4.2s linear infinite',
                      }}
                    >
                      CURRENT WORD
                    </p>
                  </div>
                  <h2
                    style={{
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      margin: 0,
                      fontSize: currentWordPanel.wordFontSize,
                      lineHeight: 1.25,
                      letterSpacing: '0.08em',
                    }}
                  >
                    {infoPanelPlot.word_id}
                  </h2>
                </div>
              </div>

              <p
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  margin: 0,
                  maxHeight: `${currentWordPanel.bodyMaxHeight}px`,
                  fontSize: currentWordPanel.bodyFontSize,
                  lineHeight: 1.9,
                  letterSpacing: '0.06em',
                  color: emotionUiTheme.textSecondary,
                }}
              >
                {infoPanelPlot.meaning?.trim() ||
                  'この単語の意味データはまだ登録されていません。'}
              </p>

              <dl
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridTemplateRows: 'auto auto',
                  columnGap: `${currentWordPanel.columnGap}px`,
                  rowGap: `${currentWordPanel.rowGap}px`,
                  margin: 0,
                  padding: '2px 0',
                  fontSize: currentWordPanel.dlFontSize,
                }}
              >
                <dt style={{ color: emotionUiTheme.textMuted }}>主感情</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>
                  {infoPanelPlot.primaryLabel ?? getEmotionById(infoPanelPlot.primaryId).label}
                </dd>
                <dt style={{ color: emotionUiTheme.textMuted }}>副感情</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>
                  {infoPanelPlot.secondaryLabel ?? getEmotionById(infoPanelPlot.secondaryId).label}
                </dd>
                <dt style={{ color: emotionUiTheme.textMuted }}>強度</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{infoPanelPlot.intensity}</dd>
                <dt style={{ color: emotionUiTheme.textMuted }}>種別</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>
                  {getPlotKindLabel(infoPanelPlot)}
                </dd>
              </dl>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: `${currentWordPanel.innerGap}px`,
                  paddingRight: '2px',
                }}
              >
                <p
                  style={{
                    writingMode: 'vertical-rl',
                    margin: 0,
                    fontSize: currentWordPanel.metaFontSize,
                    letterSpacing: '0.14em',
                    color: emotionUiTheme.textMuted,
                  }}
                >
                  強度
                </p>
                <div
                  style={{
                    width: `${currentWordPanel.intensityBarWidth}px`,
                    height: `${currentWordPanel.intensityBarHeight}px`,
                    overflow: 'hidden',
                    borderRadius: '999px',
                    backgroundColor: emotionUiTheme.divider,
                    display: 'flex',
                    alignItems: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${(infoPanelPlot.intensity / EMOTION_INTENSITY_MAX) * 100}%`,
                      borderRadius: '999px',
                      background: `linear-gradient(180deg, ${emotionUiTheme.intensityGradientStart}, ${emotionUiTheme.intensityGradientEnd})`,
                    }}
                  />
                </div>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}

export default App;
