import { Html } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { UserPlotRow } from '../types/userPlot';
import { getAtmosphericAppearance } from '../utils/plotAtmosphere';
import { plotColorFromRow, plotPositionFromRow } from '../utils/plotFromUserPlot';
import { getPlotLabelStyle } from '../utils/plotLabelStyle';

interface WordPlotProps {
  plot: UserPlotRow;
  currentMode: string;
  isSelected: boolean;
  onSelect: (wordId: string) => void;
}

export function WordPlot({ plot, currentMode, isSelected, onSelect }: WordPlotProps) {
  const { size, camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const worldPosition = useRef(new THREE.Vector3());
  const fadedColor = useRef(new THREE.Color());
  const isVisible = plot.mode === currentMode;

  const labelStyle = useMemo(
    () => getPlotLabelStyle(size.width, size.height, isSelected),
    [size.width, size.height, isSelected],
  );
  const position = useMemo(() => plotPositionFromRow(plot), [plot]);
  const color = useMemo(() => plotColorFromRow(plot), [plot]);
  const baseColor = useMemo(() => {
    const parsed = new THREE.Color();
    parsed.setStyle(color);
    return parsed;
  }, [color]);

  useFrame(() => {
    if (!isVisible) return;

    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.getWorldPosition(worldPosition.current);
    const distance = camera.position.distanceTo(worldPosition.current);
    const appearance = getAtmosphericAppearance(distance, baseColor, isSelected, fadedColor.current);
    const material = mesh.material as THREE.MeshBasicMaterial;

    material.opacity = appearance.opacity;
    material.transparent = appearance.opacity < 1;
    material.color.copy(appearance.color);

    if (labelRef.current) {
      labelRef.current.style.opacity = String(appearance.opacity);
      labelRef.current.style.color = appearance.color.getStyle();
    }
  });

  if (!isVisible) {
    return null;
  }

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(plot.word_id);
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
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
        <meshBasicMaterial color={color} transparent />
      </mesh>

      <Html center distanceFactor={labelStyle.distanceFactor} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div
          ref={labelRef}
          style={{
            color,
            fontSize: labelStyle.fontSize,
            fontWeight: isSelected ? 700 : 400,
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            fontFamily: 'system-ui, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", sans-serif',
            textShadow: '0 0 8px rgba(0,0,0,0.9)',
            transform: `translateY(calc(50% + ${labelStyle.screenOffsetY}px))`,
          }}
        >
          {plot.word_id}
        </div>
      </Html>
    </group>
  );
}
