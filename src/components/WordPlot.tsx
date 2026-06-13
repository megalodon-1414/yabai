import { Billboard, Html } from '@react-three/drei';
import type { WordData } from '../types/word';
import { getWordColor } from '../utils/wordColor';

interface WordPlotProps {
  word: WordData;
  currentMode: 'emotion' | 'state';
}

export function WordPlot({ word, currentMode }: WordPlotProps) {
  if (word.type !== currentMode) {
    return null;
  }

  let x = 0;
  let y = word.frequency * 0.05;
  let z = 0;

  if (word.type === 'emotion') {
    const rad = (word.angle * Math.PI) / 180;
    x = word.intensity * Math.cos(rad) * 0.05;
    z = word.intensity * Math.sin(rad) * 0.05;
  } else {
    x = word.perception * 0.5;
    z = word.quality * 0.5;
  }

  const color = getWordColor(word);

  return (
    <Billboard position={[x, y, z]}>
      <Html center distanceFactor={10} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div
          style={{
            color,
            fontSize: '18px',
            fontWeight: 400,
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            fontFamily: 'system-ui, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", sans-serif',
            textShadow: '0 0 8px rgba(0,0,0,0.9)',
          }}
        >
          {word.text}
        </div>
      </Html>
    </Billboard>
  );
}
