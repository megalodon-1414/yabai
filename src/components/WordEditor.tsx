import { useEffect, useRef } from 'react';
import type { PlotStatus } from '../hooks/usePlotSubmit';
import type { UserPlotRow } from '../types/userPlot';
import { CircularAngleSlider } from './CircularAngleSlider';
import { createDefaultPlot, getPlotsForMode, type PlotMode } from '../utils/plotHelpers';

interface WordEditorProps {
  plots: UserPlotRow[];
  currentMode: PlotMode;
  selectedId: string | null;
  plotStatus: PlotStatus;
  onSelect: (id: string) => void;
  onChange: (plot: UserPlotRow, previousId?: string) => void;
  onAdd: (plot: UserPlotRow) => void;
  onDelete: (id: string) => void;
}

function plotStatusLabel(status: PlotStatus): string | null {
  switch (status) {
    case 'saving':
      return 'プロット中…';
    case 'saved':
      return 'Supabaseに反映しました';
    case 'error':
      return 'プロットに失敗しました';
    default:
      return null;
  }
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

function HueField({
  value,
  onChange,
  useCircular,
}: {
  value: number;
  onChange: (value: number) => void;
  useCircular: boolean;
}) {
  if (useCircular) {
    return (
      <div style={{ marginBottom: '12px' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#c5c6c7' }}>
          <span>色相 / 角度 (0〜360°)</span>
          <span style={{ color: '#45f3ff' }}>{Math.round(value)}°</span>
        </span>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CircularAngleSlider value={value} onChange={onChange} />
        </div>
      </div>
    );
  }

  return (
    <NumberField
      label="色相 (0〜360°)"
      value={value}
      min={0}
      max={360}
      onChange={onChange}
    />
  );
}

export function WordEditor({
  plots,
  currentMode,
  selectedId,
  plotStatus,
  onSelect,
  onChange,
  onAdd,
  onDelete,
}: WordEditorProps) {
  const visiblePlots = getPlotsForMode(plots, currentMode);
  const selectedPlot = plots.find((plot) => plot.word_id === selectedId) ?? null;
  const accentColor = currentMode === 'emotion' ? '#4ea8de' : '#4abc96';
  const listItemRefs = useRef(new Map<string, HTMLButtonElement>());
  const statusLabel = plotStatusLabel(plotStatus);

  useEffect(() => {
    if (!selectedId) return;
    listItemRefs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const handleAdd = () => {
    const newPlot = createDefaultPlot(currentMode);
    onAdd(newPlot);
    onSelect(newPlot.word_id);
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
          {currentMode === 'emotion' ? '感情空間（編集後はプロットで反映）' : '状態空間（編集後はプロットで反映）'}
        </p>
        {statusLabel && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: '0.75rem',
              color: plotStatus === 'error' ? '#ff0055' : '#45f3ff',
            }}
          >
            {statusLabel}
          </p>
        )}
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

      <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '8px', flexShrink: 0 }}>
        {visiblePlots.length === 0 && (
          <p style={{ margin: '8px 4px', fontSize: '0.85rem', color: '#9ca3af' }}>
            データがありません。追加するか Supabase にデータを登録してください。
          </p>
        )}
        {visiblePlots.map((plot) => {
          const isSelected = plot.word_id === selectedId;

          return (
            <button
              key={plot.word_id}
              type="button"
              ref={(element) => {
                if (element) {
                  listItemRefs.current.set(plot.word_id, element);
                } else {
                  listItemRefs.current.delete(plot.word_id);
                }
              }}
              onClick={() => onSelect(plot.word_id)}
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
              {plot.word_id}
            </button>
          );
        })}
      </div>

      {selectedPlot && (
        <div style={{ padding: '16px', borderTop: '1px solid #1f2833', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#fff' }}>パラメータ編集</h3>

          <TextField
            label="単語ID"
            value={selectedPlot.word_id}
            onChange={(word_id) =>
              onChange({ ...selectedPlot, word_id }, selectedPlot.word_id)
            }
          />

          <HueField
            value={selectedPlot.hue}
            onChange={(hue) => onChange({ ...selectedPlot, hue })}
            useCircular={currentMode === 'emotion'}
          />

          <NumberField
            label="明度 (25〜80)"
            value={selectedPlot.brightness}
            min={25}
            max={80}
            step={0.1}
            onChange={(brightness) => onChange({ ...selectedPlot, brightness })}
          />

          <NumberField
            label="彩度 (0〜100)"
            value={selectedPlot.saturation}
            min={0}
            max={100}
            onChange={(saturation) => onChange({ ...selectedPlot, saturation })}
          />

          <button
            type="button"
            onClick={() => onDelete(selectedPlot.word_id)}
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
