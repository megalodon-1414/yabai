import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { EmotionVector } from '../types/userPlot';
import { EMOTION_LABELS, PRIMARY_EMOTIONS, type PrimaryEmotion } from '../emotionSpace/emotions';
import { clampEmotionVector } from '../emotionSpace/migrate';

interface EmotionRadarChartProps {
  values: EmotionVector;
  onChange: (values: EmotionVector) => void;
  size?: number;
}

const CHART_COLORS = [
  '#f9d71c',
  '#7bc96f',
  '#6b5ce7',
  '#4ecdc4',
  '#5b8def',
  '#9b59b6',
  '#e74c3c',
  '#f39c12',
];

function axisPoint(
  center: number,
  radius: number,
  index: number,
  value: number,
): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / PRIMARY_EMOTIONS.length;
  const r = (value / 100) * radius;
  return {
    x: center + r * Math.cos(angle),
    y: center + r * Math.sin(angle),
  };
}

export function EmotionRadarChart({ values, onChange, size = 260 }: EmotionRadarChartProps) {
  const center = size / 2;
  const maxRadius = size * 0.34;
  const dragging = useRef<PrimaryEmotion | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const polygonPoints = PRIMARY_EMOTIONS.map((emotion, index) => {
    const point = axisPoint(center, maxRadius, index, values[emotion]);
    return `${point.x},${point.y}`;
  }).join(' ');

  const updateFromPointer = (emotion: PrimaryEmotion, clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left - center;
    const y = clientY - rect.top - center;
    const index = PRIMARY_EMOTIONS.indexOf(emotion);
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / PRIMARY_EMOTIONS.length;
    const axisX = Math.cos(angle);
    const axisY = Math.sin(angle);
    const projected = x * axisX + y * axisY;
    const next = Math.round(Math.max(0, Math.min(100, (projected / maxRadius) * 100)));

    onChange(clampEmotionVector({ ...values, [emotion]: next }));
  };

  const handlePointerDown = (emotion: PrimaryEmotion) => (event: ReactPointerEvent) => {
    dragging.current = emotion;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(emotion, event.clientX, event.clientY);
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (!dragging.current) return;
    updateFromPointer(dragging.current, event.clientX, event.clientY);
  };

  const handlePointerUp = (event: ReactPointerEvent) => {
    dragging.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none', userSelect: 'none' }}
      >
        {[20, 40, 60, 80, 100].map((level) => (
          <polygon
            key={level}
            points={PRIMARY_EMOTIONS.map((_, index) => {
              const point = axisPoint(center, maxRadius, index, level);
              return `${point.x},${point.y}`;
            }).join(' ')}
            fill="none"
            stroke="rgba(69, 243, 255, 0.12)"
            strokeWidth={1}
          />
        ))}

        {PRIMARY_EMOTIONS.map((emotion, index) => {
          const end = axisPoint(center, maxRadius, index, 100);
          return (
            <line
              key={`axis-${emotion}`}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke="rgba(197, 198, 199, 0.35)"
              strokeWidth={1}
            />
          );
        })}

        <polygon
          points={polygonPoints}
          fill="rgba(69, 243, 255, 0.18)"
          stroke="#45f3ff"
          strokeWidth={2}
        />

        {PRIMARY_EMOTIONS.map((emotion, index) => {
          const point = axisPoint(center, maxRadius, index, values[emotion]);
          return (
            <circle
              key={`handle-${emotion}`}
              cx={point.x}
              cy={point.y}
              r={7}
              fill={CHART_COLORS[index]}
              stroke="#0b0c10"
              strokeWidth={2}
              style={{ cursor: 'grab' }}
              onPointerDown={handlePointerDown(emotion)}
            />
          );
        })}
      </svg>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '8px',
          width: '100%',
        }}
      >
        {PRIMARY_EMOTIONS.map((emotion, index) => (
          <label key={emotion} style={{ fontSize: '0.78rem', color: '#c5c6c7' }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: CHART_COLORS[index] }}>{EMOTION_LABELS[emotion]}</span>
              <span style={{ color: '#45f3ff' }}>{values[emotion]}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={values[emotion]}
              onChange={(e) =>
                onChange(clampEmotionVector({ ...values, [emotion]: Number(e.target.value) }))
              }
              style={{ width: '100%', accentColor: CHART_COLORS[index] }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
