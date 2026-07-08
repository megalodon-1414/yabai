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
  const [hoveredScreenPoint, setHoveredScreenPoint] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [mainSize, setMainSize] = useState({ width: 0, height: 0 });
  const [infoPanelWordId, setInfoPanelWordId] = useState<string | null>(null);
  const [isInfoPanelVisible, setIsInfoPanelVisible] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [isExplorationMode, setIsExplorationMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { plotStatus, submitPlots } = usePlotSubmit();

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
      hoveredWordId && hoveredWordId !== selectedId
        ? displayPlots.find((plot) => plot.word_id === hoveredWordId) ?? null
        : null,
    [displayPlots, hoveredWordId, selectedId],
  );

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

  const handleToggleExplorationMode = () => {
    setIsExplorationMode((prev) => {
      const next = !prev;
      if (next) {
        setIsEditorOpen(false);
        const plotsWithDummies = mergeExplorationDummyPlots(plots, true);
        setSelectedId(pickRandomPlotId(plotsWithDummies));
      }
      return next;
    });
  };

  const handleRandomExplorationStart = () => {
    setSelectedId(pickRandomPlotId(displayPlots));
  };

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

  const handleSubmitPlots = () => {
    void submitPlots(plots.filter((plot) => !isExplorationDummyPlot(plot.word_id)));
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

  const showInfoGuideLine =
    isExplorationMode &&
    isInfoPanelVisible &&
    infoPanelPlot &&
    selectedScreenPoint &&
    mainSize.width > 0 &&
    mainSize.height > 0;
  const nextWordPanel = {
    x: Math.max(0, mainSize.width - 488),
    y: 24,
    width: 152,
    collapsedHeight: 48,
    expandedHeight: 92,
  };
  const showHoverGuide =
    isExplorationMode &&
    isInfoPanelVisible &&
    hoveredPlot &&
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
        `}
      </style>
      <header style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2833' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#45f3ff' }}>応プロ: 「ヤバい」可視化システム</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleSubmitPlots}
            disabled={plotStatus === 'saving'}
            style={{
              padding: '10px 20px', fontSize: '1rem', cursor: plotStatus === 'saving' ? 'wait' : 'pointer',
              backgroundColor: '#45f3ff', color: '#0b0c10', border: 'none', borderRadius: '4px', fontWeight: 600,
            }}
          >
            {plotStatus === 'saving' ? 'プロット中…' : 'プロット'}
          </button>
          <button
            type="button"
            onClick={() => void loadPlots()}
            disabled={isLoading}
            style={{
              padding: '10px 20px', fontSize: '1rem', cursor: isLoading ? 'wait' : 'pointer',
              backgroundColor: '#1f2833', color: '#45f3ff', border: 'none', borderRadius: '4px',
            }}
          >
            {isLoading ? '読込中…' : '再読込'}
          </button>
          <button
            type="button"
            onClick={handleRandomExplorationStart}
            disabled={!isExplorationMode || displayPlots.length === 0}
            style={{
              padding: '10px 20px', fontSize: '1rem',
              cursor: !isExplorationMode || displayPlots.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: '#1f2833', color: '#c39bd3', border: 'none', borderRadius: '4px',
              opacity: isExplorationMode ? 1 : 0.45,
            }}
          >
            別の単語から再開
          </button>
          <button
            type="button"
            onClick={handleToggleExplorationMode}
            style={{
              padding: '10px 20px', fontSize: '1rem', cursor: 'pointer',
              backgroundColor: isExplorationMode ? '#9b59b6' : '#1f2833',
              color: '#fff', border: 'none', borderRadius: '4px', fontWeight: isExplorationMode ? 600 : 400,
            }}
          >
            探索モード {isExplorationMode ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setIsEditorOpen((open) => !open)}
            disabled={isExplorationMode}
            style={{
              padding: '10px 20px', fontSize: '1rem', cursor: 'pointer',
              backgroundColor: isEditorOpen ? '#45f3ff' : '#1f2833',
              color: isEditorOpen ? '#0b0c10' : '#fff',
              border: 'none', borderRadius: '4px', fontWeight: isEditorOpen ? 600 : 400,
            }}
          >
            単語エディタ {isEditorOpen ? '▲' : '▼'}
          </button>
        </div>
      </header>

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
          onHoveredWordChange={setHoveredWordId}
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
                x2={Math.max(0, mainSize.width - 174)}
                y2={mainSize.height / 2}
                stroke="rgba(244, 236, 247, 0.62)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {showHoverGuide && hoveredScreenPoint && (
              <line
                x1={hoveredScreenPoint.x}
                y1={hoveredScreenPoint.y}
                x2={nextWordPanel.x + (nextWordPanel.width + 28) / 2}
                y2={nextWordPanel.y + nextWordPanel.expandedHeight - 24}
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
              left: `${nextWordPanel.x}px`,
              top: `${nextWordPanel.y}px`,
              zIndex: 2,
              width: `${nextWordPanel.width}px`,
              height: `${hoveredPlot ? nextWordPanel.expandedHeight : nextWordPanel.collapsedHeight}px`,
              padding: '12px 14px',
              border: '1px solid rgba(195, 155, 211, 0.32)',
              borderRadius: '16px',
              backgroundColor: 'rgba(8, 8, 14, 0.78)',
              boxShadow: '0 18px 40px rgba(0, 0, 0, 0.34)',
              backdropFilter: 'blur(12px)',
              color: '#f4ecf7',
              opacity: isInfoPanelVisible ? 1 : 0,
              overflow: 'hidden',
              transition: 'opacity 150ms ease, height 160ms ease',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.16em', color: '#c39bd3', whiteSpace: 'nowrap' }}>
                NEXT WORD
              </p>
              <span
                style={{
                  display: 'block',
                  width: 0,
                  height: 0,
                  borderTop: '5px solid transparent',
                  borderBottom: '5px solid transparent',
                  borderRight: '9px solid #c39bd3',
                  opacity: hoveredPlot ? 1 : 0.45,
                  animation: hoveredPlot ? 'nextWordArrowPulse 900ms ease-in-out infinite' : 'none',
                  transition: 'opacity 160ms ease',
                }}
              />
            </div>
            <div
              style={{
                marginTop: '18px',
                fontSize: '1rem',
                fontWeight: 700,
                lineHeight: 1.2,
                color: '#f4ecf7',
                opacity: hoveredPlot ? 1 : 0,
                transform: hoveredPlot ? 'translateY(0)' : 'translateY(-6px)',
                transition: 'opacity 140ms ease, transform 160ms ease',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {hoveredPlot?.word_id ?? ''}
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
              top: '24px',
              right: '24px',
              width: '300px',
              zIndex: 2,
              padding: '18px',
              border: '1px solid rgba(195, 155, 211, 0.32)',
              borderRadius: '16px',
              backgroundColor: 'rgba(8, 8, 14, 0.78)',
              boxShadow: '0 18px 40px rgba(0, 0, 0, 0.34)',
              backdropFilter: 'blur(12px)',
              color: '#f4ecf7',
              pointerEvents: 'none',
              opacity: isInfoPanelVisible ? 1 : 0,
              transition: 'opacity 150ms ease',
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', letterSpacing: '0.16em', color: '#c39bd3' }}>
              CURRENT WORD
            </p>
            <h2 style={{ margin: '0 0 14px 0', fontSize: '2rem', lineHeight: 1.1 }}>
              {infoPanelPlot.word_id}
            </h2>
            <p style={{ margin: '0 0 18px 0', fontSize: '0.9rem', lineHeight: 1.7, color: '#d8c7df' }}>
              仮の説明テキストです。この単語が持つ「ヤバい」の感触、使われる場面、近いニュアンスをここに表示します。
            </p>

            <dl style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: '10px 12px', margin: 0, fontSize: '0.9rem' }}>
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

            <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.78rem', color: '#9f8aaa' }}>PARAMETER</p>
              <div style={{ height: '8px', overflow: 'hidden', borderRadius: '999px', backgroundColor: 'rgba(255, 255, 255, 0.12)' }}>
                <div
                  style={{
                    width: `${(infoPanelPlot.intensity / EMOTION_INTENSITY_MAX) * 100}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: 'linear-gradient(90deg, #9b59b6, #45f3ff)',
                  }}
                />
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}

export default App;
