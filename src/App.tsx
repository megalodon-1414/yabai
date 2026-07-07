import { useCallback, useEffect, useState } from 'react';
import { SpaceCanvas } from './components/SpaceCanvas';
import { WordEditor } from './components/WordEditor';
import { usePlotSubmit } from './hooks/usePlotSubmit';
import { fetchUserPlots } from './services/userPlots';
import type { UserPlotRow } from './types/userPlot';
import {
  getPlotsForMode,
  type PlotMode,
  removePlotById,
  replacePlotId,
  updatePlot,
} from './utils/plotHelpers';
import { mergeWithSeedPlots } from './utils/seedPlots';

function App() {
  const [currentMode, setCurrentMode] = useState<PlotMode>('emotion');
  const [plots, setPlots] = useState<UserPlotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
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
    if (selectedId) return;
    const first = getPlotsForMode(plots, currentMode)[0];
    if (first) setSelectedId(first.word_id);
  }, [plots, currentMode, selectedId]);

  const handleModeChange = (mode: PlotMode) => {
    setCurrentMode(mode);
    const visiblePlots = getPlotsForMode(plots, mode);
    if (selectedId && !visiblePlots.some((plot) => plot.word_id === selectedId)) {
      setSelectedId(visiblePlots[0]?.word_id ?? null);
    }
  };

  const handlePlotChange = (updated: UserPlotRow, previousId?: string) => {
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
    setIsEditorOpen(true);
  };

  const handlePlotDelete = (id: string) => {
    setPlots((prev) => removePlotById(prev, id));
    setSelectedId((prev) => (prev === id ? null : prev));
  };

  const handleSubmitPlots = () => {
    void submitPlots(plots);
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
            onClick={() => setIsEditorOpen((open) => !open)}
            style={{
              padding: '10px 20px', fontSize: '1rem', cursor: 'pointer',
              backgroundColor: isEditorOpen ? '#45f3ff' : '#1f2833',
              color: isEditorOpen ? '#0b0c10' : '#fff',
              border: 'none', borderRadius: '4px', fontWeight: isEditorOpen ? 600 : 400,
            }}
          >
            単語エディタ {isEditorOpen ? '▲' : '▼'}
          </button>
          <button
            onClick={() => handleModeChange('emotion')}
            style={{
              padding: '10px 20px', fontSize: '1rem', cursor: 'pointer',
              backgroundColor: currentMode === 'emotion' ? '#4ea8de' : '#1f2833', color: '#fff', border: 'none', borderRadius: '4px'
            }}
          >
            感情空間 (円環モデル)
          </button>
          <button
            onClick={() => handleModeChange('state')}
            style={{
              padding: '10px 20px', fontSize: '1rem', cursor: 'pointer',
              backgroundColor: currentMode === 'state' ? '#4abc96' : '#1f2833', color: '#fff', border: 'none', borderRadius: '4px'
            }}
          >
            状態空間 (五感・善悪)
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
          plots={plots}
          currentMode={currentMode}
          selectedId={selectedId}
          onWordSelect={handleWordSelect}
        />

        {isEditorOpen && (
          <WordEditor
            plots={plots}
            currentMode={currentMode}
            selectedId={selectedId}
            plotStatus={plotStatus}
            onSelect={handleWordSelect}
            onChange={handlePlotChange}
            onAdd={handlePlotAdd}
            onDelete={handlePlotDelete}
          />
        )}

        {!isEditorOpen && (
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

        <div style={{ position: 'absolute', bottom: '20px', left: '20px', pointerEvents: 'none', backgroundColor: 'rgba(0,0,0,0.7)', padding: '15px', borderRadius: '5px', fontSize: '0.9rem' }}>
          <p style={{ margin: '0 0 5px 0' }}>🖱️ ドラッグ: 回転</p>
          <p style={{ margin: '0 0 5px 0' }}>📜 ホイール: ズーム</p>
          <p style={{ margin: '0 0 5px 0' }}>データ: Supabase + 語彙シード ({plots.filter((p) => p.mode === currentMode).length} 件)</p>
          <p style={{ margin: 0 }}>現在の表示: <strong style={{ color: currentMode === 'emotion' ? '#4ea8de' : '#4abc96' }}>{currentMode === 'emotion' ? '感情空間' : '状態空間'}</strong></p>
        </div>
      </main>
    </div>
  );
}

export default App;
