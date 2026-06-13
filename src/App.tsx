import { useState } from 'react';
import { initialWords } from './data/wordsData';
import { SpaceCanvas } from './components/SpaceCanvas';
import { WordEditor } from './components/WordEditor';
import type { WordData } from './types/word';
import { getWordsForMode, updateWord } from './utils/wordHelpers';

function App() {
  const [currentMode, setCurrentMode] = useState<'emotion' | 'state'>('emotion');
  const [words, setWords] = useState<WordData[]>(initialWords);
  const [selectedId, setSelectedId] = useState<string | null>('e-1');
  const [isEditorOpen, setIsEditorOpen] = useState(true);

  const handleModeChange = (mode: 'emotion' | 'state') => {
    setCurrentMode(mode);
    const visibleWords = getWordsForMode(words, mode);
    if (selectedId && !visibleWords.some((word) => word.id === selectedId)) {
      setSelectedId(visibleWords[0]?.id ?? null);
    }
  };

  const handleWordChange = (updated: WordData) => {
    setWords((prev) => updateWord(prev, updated));
  };

  const handleWordAdd = (word: WordData) => {
    setWords((prev) => [...prev, word]);
  };

  const handleWordSelect = (id: string) => {
    setSelectedId(id);
    setIsEditorOpen(true);
  };

  const handleWordDelete = (id: string) => {
    setWords((prev) => prev.filter((word) => word.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', backgroundColor: '#0b0c10', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      <header style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2833' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#45f3ff' }}>応プロ: 「ヤバい」可視化システム</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
        <SpaceCanvas
          words={words}
          currentMode={currentMode}
          selectedId={selectedId}
          onWordSelect={handleWordSelect}
        />

        {isEditorOpen && (
          <WordEditor
            words={words}
            currentMode={currentMode}
            selectedId={selectedId}
            onSelect={handleWordSelect}
            onChange={handleWordChange}
            onAdd={handleWordAdd}
            onDelete={handleWordDelete}
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
          <p style={{ margin: 0 }}>現在の表示: <strong style={{ color: currentMode === 'emotion' ? '#4ea8de' : '#4abc96' }}>{currentMode === 'emotion' ? '感情空間' : '状態空間'}</strong></p>
        </div>
      </main>
    </div>
  );
}

export default App;
