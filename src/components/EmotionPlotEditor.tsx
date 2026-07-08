import type { CSSProperties } from 'react';
import type { BasicEmotionId, EmotionId } from '../data/emotions';
import { BASIC_EMOTIONS, DYAD_EMOTIONS, getEmotionById, isBasicEmotionId } from '../data/emotions';
import type { UserPlotRow } from '../types/userPlot';
import { clampIntensity, isPurePlot, normalizeUserPlotRow } from '../utils/emotionPlotBridge';

interface EmotionPlotEditorProps {
  plot: UserPlotRow;
  onChange: (plot: UserPlotRow) => void;
}

const selectStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  borderRadius: '4px',
  border: '1px solid #1f2833',
  backgroundColor: '#0b0c10',
  color: '#fff',
  fontSize: '0.9rem',
};

function handlePrimaryChange(plot: UserPlotRow, primaryId: EmotionId): UserPlotRow {
  let secondaryId = plot.secondaryId;

  if (isBasicEmotionId(primaryId)) {
    if (!isPurePlot(plot) && !BASIC_EMOTIONS.some((e) => e.id === secondaryId)) {
      secondaryId = primaryId;
    }
  } else {
    const dyad = getEmotionById(primaryId);
    if ('components' in dyad) {
      secondaryId = dyad.components[0];
    }
  }

  return normalizeUserPlotRow({ ...plot, primaryId, secondaryId });
}

export function EmotionPlotEditor({ plot, onChange }: EmotionPlotEditorProps) {
  const pure = isPurePlot(plot);

  return (
    <div>
      <label style={{ display: 'block', marginBottom: '12px' }}>
        <span style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: '#c5c6c7' }}>
          主感情（8基本 / 24中間）
        </span>
        <select
          value={plot.primaryId}
          onChange={(e) => onChange(handlePrimaryChange(plot, e.target.value as EmotionId))}
          style={selectStyle}
        >
          <optgroup label="基本8感情">
            {BASIC_EMOTIONS.map((emotion) => (
              <option key={emotion.id} value={emotion.id}>
                {emotion.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="中間24感情">
            {DYAD_EMOTIONS.map((dyad) => (
              <option key={dyad.id} value={dyad.id}>
                {dyad.label}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <label style={{ display: 'block', marginBottom: '12px' }}>
        <span style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: '#c5c6c7' }}>
          副感情（基本8・方向のヒント）
        </span>
        <select
          value={plot.secondaryId}
          onChange={(e) =>
            onChange(normalizeUserPlotRow({ ...plot, secondaryId: e.target.value as BasicEmotionId }))
          }
          style={selectStyle}
        >
          {BASIC_EMOTIONS.map((emotion) => (
            <option key={emotion.id} value={emotion.id}>
              {emotion.label}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'block', marginBottom: '8px' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem', color: '#c5c6c7' }}>
          <span>強度 (0〜100)</span>
          <span style={{ color: '#45f3ff' }}>{plot.intensity}</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={plot.intensity}
          onChange={(e) =>
            onChange(normalizeUserPlotRow({ ...plot, intensity: clampIntensity(Number(e.target.value)) }))
          }
          style={{ width: '100%', accentColor: '#45f3ff' }}
        />
      </label>

      <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.5 }}>
        {pure
          ? '主・副が同じ基本感情 → 感情球の中心周りを公転します。'
          : '主感情の領域から、副感情の方向へ強度に応じて配置されます。'}
      </p>
    </div>
  );
}
