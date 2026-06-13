import type { EmotionWord, StateWord, WordData } from '../types/word';
import {
  createDefaultWord,
  getWordsForMode,
  isEmotionWord,
  isStateWord,
} from '../utils/wordHelpers';

interface WordEditorProps {
  words: WordData[];
  currentMode: 'emotion' | 'state';
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (word: WordData) => void;
  onAdd: (word: WordData) => void;
  onDelete: (id: string) => void;
}

interface FieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, min, max, step = 1, onChange }: FieldProps) {
  return (
    <label style={{ display: 'block', marginBottom: '12px' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem', color: '#c5c6c7' }}>
        <span>{label}</span>
        <span style={{ color: '#45f3ff' }}>{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#45f3ff' }}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: 'block', marginBottom: '12px' }}>
      <span style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: '#c5c6c7' }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 10px',
          borderRadius: '4px',
          border: '1px solid #1f2833',
          backgroundColor: '#0b0c10',
          color: '#fff',
          fontSize: '0.95rem',
        }}
      />
    </label>
  );
}

function EmotionFields({
  word,
  onChange,
}: {
  word: EmotionWord;
  onChange: (word: EmotionWord) => void;
}) {
  return (
    <>
      <NumberField
        label="角度 (0〜360°)"
        value={word.angle}
        min={0}
        max={360}
        onChange={(angle) => onChange({ ...word, angle })}
      />
      <NumberField
        label="強度 (0〜100)"
        value={word.intensity}
        min={0}
        max={100}
        onChange={(intensity) => onChange({ ...word, intensity })}
      />
    </>
  );
}

function StateFields({
  word,
  onChange,
}: {
  word: StateWord;
  onChange: (word: StateWord) => void;
}) {
  return (
    <>
      <NumberField
        label="感知 (-10 論理 〜 +10 身体五感)"
        value={word.perception}
        min={-10}
        max={10}
        onChange={(perception) => onChange({ ...word, perception })}
      />
      <NumberField
        label="善悪 (-10 悪 〜 +10 良)"
        value={word.quality}
        min={-10}
        max={10}
        onChange={(quality) => onChange({ ...word, quality })}
      />
    </>
  );
}

export function WordEditor({
  words,
  currentMode,
  selectedId,
  onSelect,
  onChange,
  onAdd,
  onDelete,
}: WordEditorProps) {
  const visibleWords = getWordsForMode(words, currentMode);
  const selectedWord = words.find((word) => word.id === selectedId) ?? null;
  const accentColor = currentMode === 'emotion' ? '#4ea8de' : '#4abc96';

  const handleAdd = () => {
    const newWord = createDefaultWord(currentMode);
    onAdd(newWord);
    onSelect(newWord.id);
  };

  return (
    <aside
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        width: '300px',
        maxHeight: 'calc(100% - 32px)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(11, 12, 16, 0.92)',
        border: '1px solid #1f2833',
        borderRadius: '8px',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1f2833' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', color: accentColor }}>単語エディタ</h2>
        <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
          {currentMode === 'emotion' ? '感情空間の単語を編集' : '状態空間の単語を編集'}
        </p>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f2833' }}>
        <button
          type="button"
          onClick={handleAdd}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: accentColor,
            color: '#0b0c10',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + 単語を追加
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {visibleWords.map((word) => {
          const isSelected = word.id === selectedId;

          return (
            <button
              key={word.id}
              type="button"
              onClick={() => onSelect(word.id)}
              style={{
                width: '100%',
                display: 'block',
                marginBottom: '6px',
                padding: '10px 12px',
                textAlign: 'left',
                border: isSelected ? `1px solid ${accentColor}` : '1px solid #1f2833',
                borderRadius: '4px',
                backgroundColor: isSelected ? 'rgba(69, 243, 255, 0.08)' : '#0b0c10',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {word.text}
            </button>
          );
        })}
      </div>

      {selectedWord && (
        <div style={{ padding: '16px', borderTop: '1px solid #1f2833', overflowY: 'auto', maxHeight: '55%' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#fff' }}>パラメータ編集</h3>

          <TextField
            label="単語名"
            value={selectedWord.text}
            onChange={(text) => onChange({ ...selectedWord, text })}
          />

          <NumberField
            label="出現頻度 (0〜100)"
            value={selectedWord.frequency}
            min={0}
            max={100}
            onChange={(frequency) => onChange({ ...selectedWord, frequency })}
          />

          {isEmotionWord(selectedWord) && (
            <EmotionFields
              word={selectedWord}
              onChange={onChange}
            />
          )}

          {isStateWord(selectedWord) && (
            <StateFields
              word={selectedWord}
              onChange={onChange}
            />
          )}

          <button
            type="button"
            onClick={() => onDelete(selectedWord.id)}
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '8px 12px',
              border: '1px solid #ff0055',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: '#ff0055',
              cursor: 'pointer',
            }}
          >
            この単語を削除
          </button>
        </div>
      )}
    </aside>
  );
}
