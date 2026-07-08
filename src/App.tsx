import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { pickRandomPlotId } from './utils/explorationMode';
import { mergeWithSeedPlots } from './utils/seedPlots';

function App() {
  const [plots, setPlots] = useState<UserPlotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const selectedPlot = useMemo(
    () => displayPlots.find((plot) => plot.word_id === selectedId) ?? null,
    [displayPlots, selectedId],
  );

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

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', backgroundColor: '#0b0c10', overflow: 'hidden' }}>
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

      <main style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loadError && (
          <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 2, padding: '10px 16px', backgroundColor: 'rgba(255,0,85,0.15)', border: '1px solid #ff0055', borderRadius: '8px', fontSize: '0.9rem' }}>
            {loadError}
          </div>
        )}

        <SpaceCanvas
          plots={displayPlots}
          selectedId={selectedId}
          explorationMode={isExplorationMode}
          onWordSelect={handleWordSelect}
        />

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

        {isExplorationMode && selectedPlot && (
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
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', letterSpacing: '0.16em', color: '#c39bd3' }}>
              CURRENT WORD
            </p>
            <h2 style={{ margin: '0 0 14px 0', fontSize: '2rem', lineHeight: 1.1 }}>
              {selectedPlot.word_id}
            </h2>
            <p style={{ margin: '0 0 18px 0', fontSize: '0.9rem', lineHeight: 1.7, color: '#d8c7df' }}>
              仮の説明テキストです。この単語が持つ「ヤバい」の感触、使われる場面、近いニュアンスをここに表示します。
            </p>

            <dl style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: '10px 12px', margin: 0, fontSize: '0.9rem' }}>
              <dt style={{ color: '#9f8aaa' }}>主感情</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{getEmotionById(selectedPlot.primaryId).label}</dd>
              <dt style={{ color: '#9f8aaa' }}>副感情</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{getEmotionById(selectedPlot.secondaryId).label}</dd>
              <dt style={{ color: '#9f8aaa' }}>強度</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{selectedPlot.intensity}</dd>
              <dt style={{ color: '#9f8aaa' }}>種別</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>
                {isExplorationDummyPlot(selectedPlot.word_id) ? '探索用ダミー' : '登録単語'}
              </dd>
            </dl>

            <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.78rem', color: '#9f8aaa' }}>PARAMETER</p>
              <div style={{ height: '8px', overflow: 'hidden', borderRadius: '999px', backgroundColor: 'rgba(255, 255, 255, 0.12)' }}>
                <div
                  style={{
                    width: `${selectedPlot.intensity}%`,
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
