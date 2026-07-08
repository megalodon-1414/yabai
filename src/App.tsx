import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SpaceCanvas } from './components/SpaceCanvas';
import { WordEditor } from './components/WordEditor';
import { getEmotionById } from './data/emotions';
import { usePlotSubmit } from './hooks/usePlotSubmit';
import { fetchUserPlots } from './services/userPlots';
import type { UserPlotRow } from './types/userPlot';
import {
  removePlotById,
  replacePlotId,
  updatePlot,
} from './utils/plotHelpers';
import { isExplorationDummyPlot, mergeExplorationDummyPlots } from './utils/explorationDummyPlots';
import { EMOTION_INTENSITY_MAX } from './utils/emotionPlotBridge';
import { pickRandomPlotId } from './utils/explorationMode';
import { mergeWithSeedPlots } from './utils/seedPlots';

function App() {
  const mainRef = useRef<HTMLElement>(null);
  const [plots, setPlots] = useState<UserPlotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedScreenPoint, setSelectedScreenPoint] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [hoveredWordId, setHoveredWordId] = useState<string | null>(null);
  const [hoveredWarpGateLabel, setHoveredWarpGateLabel] = useState<string | null>(null);
  const [hoveredScreenPoint, setHoveredScreenPoint] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [mainSize, setMainSize] = useState({ width: 0, height: 0 });
  const [infoPanelWordId, setInfoPanelWordId] = useState<string | null>(null);
  const [isInfoPanelVisible, setIsInfoPanelVisible] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [isExplorationMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { plotStatus } = usePlotSubmit();

  const loadPlots = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchUserPlots();
      setPlots(mergeWithSeedPlots(data));
      setSelectedId((prev) => {
        if (prev && data.some((plot) => plot.word_id === prev)) return prev;
        return null;
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

  const displayPlots = useMemo(
    () => mergeExplorationDummyPlots(plots, isExplorationMode),
    [plots, isExplorationMode],
  );

  useEffect(() => {
    if (selectedId) return;
    if (!isExplorationMode && plots[0]) {
      setSelectedId(plots[0].word_id);
    }
  }, [plots, selectedId, isExplorationMode]);

  useEffect(() => {
    if (!isExplorationMode || isLoading) return;
    if (displayPlots.length === 0) return;

    setSelectedId((prev) => {
      if (prev && displayPlots.some((plot) => plot.word_id === prev)) {
        return prev;
      }
      return pickRandomPlotId(displayPlots);
    });
  }, [isExplorationMode, isLoading, displayPlots]);

  const infoPanelPlot = useMemo(
    () => displayPlots.find((plot) => plot.word_id === infoPanelWordId) ?? null,
    [displayPlots, infoPanelWordId],
  );

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

  const handleHoveredWordChange = useCallback((wordId: string | null) => {
    setHoveredWordId(wordId);
    if (wordId) {
      setHoveredWarpGateLabel(null);
    }
  }, []);

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
  const uiGroupLeftPercent = 48;
  const uiGroupLeft = mainSize.width * (uiGroupLeftPercent / 100);
  const uiGroupTop = Math.max(24, mainSize.height * 0.5 - 180);
  const nextWordLabelLength = Array.from(nextWordLabel).length;
  const nextWordPanel = {
    x: uiGroupLeft,
    y: uiGroupTop,
    width: 80,
    collapsedHeight: 42,
    expandedHeight: Math.max(132, Math.min(260, 56 + nextWordLabelLength * 18)),
  };
  const currentWordPanel = {
    x: uiGroupLeft + nextWordPanel.width + 24,
    y: uiGroupTop,
    width: 300,
    height: 360,
  };
  const showHoverGuide =
    isExplorationMode &&
    isInfoPanelVisible &&
    nextWordLabel &&
    hoveredScreenPoint &&
    mainSize.width > 0 &&
    mainSize.height > 0;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', backgroundColor: '#0b0c10', overflow: 'hidden' }}>
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
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(4px); }
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
          plots={displayPlots}
          selectedId={selectedId}
          explorationMode={isExplorationMode}
          onSelectedScreenPosition={handleSelectedScreenPosition}
          onHoveredWordChange={handleHoveredWordChange}
          onHoveredWarpGateChange={handleHoveredWarpGateChange}
          onHoveredScreenPosition={handleHoveredScreenPosition}
          onWordSelect={handleWordSelect}
        />

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
                x2={currentWordPanel.x + currentWordPanel.width / 2}
                y2={currentWordPanel.y + currentWordPanel.height / 2}
                stroke="rgba(244, 236, 247, 0.62)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {showHoverGuide && hoveredScreenPoint && (
              <line
                x1={hoveredScreenPoint.x}
                y1={hoveredScreenPoint.y}
                x2={nextWordPanel.x + nextWordPanel.width - 12}
                y2={nextWordPanel.y + 22}
                stroke="rgba(244, 236, 247, 0.44)"
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
              left: `${uiGroupLeftPercent}%`,
              top: `${nextWordPanel.y}px`,
              zIndex: 2,
              width: `${nextWordPanel.width}px`,
              height: `${nextWordLabel ? nextWordPanel.expandedHeight : nextWordPanel.collapsedHeight}px`,
              padding: '10px',
              border: '1px solid rgba(195, 155, 211, 0.32)',
              borderLeft: '3px solid rgba(195, 155, 211, 0.62)',
              borderRadius: '12px',
              backgroundColor: 'rgba(12, 10, 16, 0.88)',
              boxShadow: '0 18px 40px rgba(0, 0, 0, 0.34), inset 8px 0 18px rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(12px)',
              color: '#f4ecf7',
              opacity: isInfoPanelVisible ? 1 : 0,
              overflow: 'hidden',
              transition: 'opacity 150ms ease, height 160ms ease',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '22px' }}>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '18px',
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
                    fontSize: '0.72rem',
                    letterSpacing: '0.14em',
                    lineHeight: '18px',
                    color: '#c39bd3',
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
                  borderTop: '5px solid transparent',
                  borderBottom: '5px solid transparent',
                  borderRight: '9px solid #c39bd3',
                  opacity: nextWordLabel ? 1 : 0.45,
                  animation: nextWordLabel ? 'nextWordArrowPulse 900ms ease-in-out infinite' : 'none',
                  transition: 'opacity 160ms ease',
                }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 18px',
                gap: '12px',
                alignItems: 'start',
                justifyItems: 'center',
                marginTop: '14px',
                opacity: nextWordLabel ? 1 : 0,
                transform: nextWordLabel ? 'translateY(0)' : 'translateY(-6px)',
                transition: 'opacity 140ms ease, transform 160ms ease',
              }}
            >
              <div
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  fontSize: '1.02rem',
                  fontWeight: 700,
                  lineHeight: 1.25,
                  letterSpacing: '0.06em',
                  color: '#f4ecf7',
                  overflow: 'hidden',
                  maxHeight: `${nextWordPanel.expandedHeight - 52}px`,
                }}
              >
                {nextWordLabel}
              </div>
              <p
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  margin: 0,
                  fontSize: '0.68rem',
                  letterSpacing: '0.12em',
                  lineHeight: 1.2,
                  color: '#c39bd3',
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
              left: `calc(${uiGroupLeftPercent}% + ${nextWordPanel.width + 24}px)`,
              width: '300px',
              minHeight: '360px',
              zIndex: 2,
              padding: '18px 16px',
              border: '1px solid rgba(214, 187, 226, 0.36)',
              borderLeft: '4px solid rgba(195, 155, 211, 0.72)',
              borderRadius: '10px',
              backgroundColor: 'rgba(12, 10, 16, 0.9)',
              boxShadow: '0 18px 40px rgba(0, 0, 0, 0.38), inset 10px 0 24px rgba(255, 255, 255, 0.035)',
              backdropFilter: 'blur(12px)',
              color: '#f4ecf7',
              pointerEvents: 'none',
              opacity: isInfoPanelVisible ? 1 : 0,
              transition: 'opacity 150ms ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row-reverse',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                gap: '18px',
                height: '100%',
                minHeight: '324px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row-reverse',
                  alignItems: 'flex-start',
                  gap: '12px',
                  paddingLeft: '14px',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: '9px solid #c39bd3',
                      animation: 'currentWordArrowPulse 900ms ease-in-out infinite',
                    }}
                  />
                  <p
                    style={{
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      margin: 0,
                      fontSize: '0.68rem',
                      letterSpacing: '0.18em',
                      color: '#c39bd3',
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
                    gap: '10px',
                    width: '50px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '50px',
                      height: '18px',
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
                        fontSize: '0.68rem',
                        letterSpacing: '0.14em',
                        lineHeight: '18px',
                        color: '#c39bd3',
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
                      fontSize: '2.25rem',
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
                  maxHeight: '320px',
                  fontSize: '0.92rem',
                  lineHeight: 1.9,
                  letterSpacing: '0.06em',
                  color: '#d8c7df',
                }}
              >
                仮の説明テキストです。この単語が持つ「ヤバい」の感触、使われる場面、近いニュアンスをここに表示します。
              </p>

              <dl
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridTemplateRows: 'auto auto',
                  columnGap: '14px',
                  rowGap: '8px',
                  margin: 0,
                  padding: '2px 0',
                  fontSize: '0.84rem',
                }}
              >
                <dt style={{ color: '#9f8aaa' }}>主感情</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{getEmotionById(infoPanelPlot.primaryId).label}</dd>
                <dt style={{ color: '#9f8aaa' }}>副感情</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{getEmotionById(infoPanelPlot.secondaryId).label}</dd>
                <dt style={{ color: '#9f8aaa' }}>強度</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{infoPanelPlot.intensity}</dd>
                <dt style={{ color: '#9f8aaa' }}>種別</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>
                  {isExplorationDummyPlot(infoPanelPlot.word_id) ? '探索用ダミー' : '登録単語'}
                </dd>
              </dl>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingRight: '2px',
                }}
              >
                <p
                  style={{
                    writingMode: 'vertical-rl',
                    margin: 0,
                    fontSize: '0.68rem',
                    letterSpacing: '0.14em',
                    color: '#9f8aaa',
                  }}
                >
                  強度
                </p>
                <div
                  style={{
                    width: '8px',
                    height: '160px',
                    overflow: 'hidden',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${(infoPanelPlot.intensity / EMOTION_INTENSITY_MAX) * 100}%`,
                      borderRadius: '999px',
                      background: 'linear-gradient(180deg, #45f3ff, #9b59b6)',
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
