import { Billboard, Html } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import type { UserPlotRow } from '../types/userPlot';
import { plotColorFromRow, plotPositionFromRow } from '../utils/plotFromUserPlot';
import { getPlotLabelStyle } from '../utils/plotLabelStyle';

interface WordPlotProps {
  plot: UserPlotRow;
  currentMode: string;
  isSelected: boolean;
  onSelect: (wordId: string) => void;
}

export function WordPlot({ plot, currentMode, isSelected, onSelect }: WordPlotProps) {
  const { size } = useThree();
  const labelStyle = useMemo(
    () => getPlotLabelStyle(size.width, size.height, isSelected),
    [size.width, size.height, isSelected],
  );

  if (plot.mode !== currentMode) {
    return null;
  }

  const position = plotPositionFromRow(plot);
  const color = plotColorFromRow(plot);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(plot.word_id);
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
        <Html center distanceFactor={labelStyle.distanceFactor} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div
            style={{
              color,
              fontSize: labelStyle.fontSize,
              fontWeight: isSelected ? 700 : 400,
              writingMode: 'vertical-rl',
              textOrientation: 'upright',
              fontFamily: 'system-ui, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", sans-serif',
              textShadow: '0 0 8px rgba(0,0,0,0.9)',
            }}
          >
            {plot.word_id}
          </div>
        </Html>
      </Billboard>
    </group>
  );
}
