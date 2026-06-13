import { Billboard, Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { WordData } from '../types/word';
import { getWordColor } from '../utils/wordColor';
import { spreadAngle, toPlotFrequency } from '../utils/plotTransform';

interface WordPlotProps {
  word: WordData;
  currentMode: 'emotion' | 'state';
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function getPlotPosition(word: WordData): [number, number, number] {
  if (word.type === 'emotion') {
    const angle = spreadAngle(word.angle, word.id);
    const frequency = toPlotFrequency(word.frequency);
    const rad = (angle * Math.PI) / 180;
    const x = word.intensity * Math.cos(rad) * 0.05;
    const y = frequency * 0.05;
    const z = word.intensity * Math.sin(rad) * 0.05;
    return [x, y, z];
  }

  return [word.perception * 0.5, word.frequency * 0.05, word.quality * 0.5];
}

export function WordPlot({ word, currentMode, isSelected, onSelect }: WordPlotProps) {
  if (word.type !== currentMode) {
    return null;
  }

  const position = getPlotPosition(word);
  const color = getWordColor(word);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(word.id);
  };

  return (
    <group position={position}>
      <mesh
        scale={isSelected ? 1.5 : 1}
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <Billboard position={[0.2, 0.15, 0]}>
        <Html center distanceFactor={10} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div
            style={{
              color,
              fontSize: '18px',
              fontWeight: isSelected ? 700 : 400,
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
    </group>
  );
}
