import { Html } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { UserPlotRow } from '../types/userPlot';
import { getAtmosphericAppearance } from '../utils/plotAtmosphere';
import { plotColorFromRow, plotPositionFromRow } from '../utils/plotFromUserPlot';
import { SELECTED_PLOT_SCALE } from '../utils/plotSelectionStyle';
import { getPlotLabelStyle, getPlotLabelTypography } from '../utils/plotLabelStyle';

const VISIBILITY_LERP_SPEED = 6;
const VISIBILITY_INTERACTION_THRESHOLD = 0.08;

interface WordPlotProps {
  plot: UserPlotRow;
  isSelected: boolean;
  isNearbyVisible: boolean;
  onSelect: (wordId: string) => void;
}

export function WordPlot({ plot, isSelected, isNearbyVisible, onSelect }: WordPlotProps) {
  const { size, camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const worldPosition = useRef(new THREE.Vector3());
  const fadedColor = useRef(new THREE.Color());
  const visibility = useRef(isNearbyVisible ? 1 : 0);

  const labelStyle = useMemo(
    () => getPlotLabelStyle(size.width, size.height, isSelected),
    [size.width, size.height, isSelected],
  );
  const labelTypography = useMemo(
    () => getPlotLabelTypography(plot, isSelected),
    [plot, isSelected],
  );
  const position = useMemo(() => plotPositionFromRow(plot), [plot]);
  const color = useMemo(() => plotColorFromRow(plot), [plot]);
  const baseColor = useMemo(() => {
    const parsed = new THREE.Color();
    parsed.setStyle(color);
    return parsed;
  }, [color]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const targetVisibility = isNearbyVisible ? 1 : 0;
    const t = 1 - Math.exp(-VISIBILITY_LERP_SPEED * delta);
    visibility.current = THREE.MathUtils.lerp(visibility.current, targetVisibility, t);

    const visibilityFactor = visibility.current;
    const isRendered = visibilityFactor > 0.01;
    mesh.visible = isRendered;

    if (!isRendered) {
      if (labelRef.current) {
        labelRef.current.style.opacity = '0';
      }
      return;
    }

    mesh.getWorldPosition(worldPosition.current);
    const distance = camera.position.distanceTo(worldPosition.current);
    const appearance = getAtmosphericAppearance(distance, baseColor, isSelected, fadedColor.current);
    const material = mesh.material as THREE.MeshBasicMaterial;
    const finalOpacity = appearance.opacity * visibilityFactor;

    material.opacity = finalOpacity;
    material.transparent = true;
    material.color.copy(appearance.color);

    if (labelRef.current) {
      labelRef.current.style.opacity = String(finalOpacity);
      labelRef.current.style.color = appearance.color.getStyle();
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (visibility.current < VISIBILITY_INTERACTION_THRESHOLD) {
      return;
    }

    event.stopPropagation();
    onSelect(plot.word_id);
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        scale={isSelected ? SELECTED_PLOT_SCALE : 1}
        onClick={handleClick}
        onPointerOver={(event) => {
          if (visibility.current < VISIBILITY_INTERACTION_THRESHOLD) {
            return;
          }

          event.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={color} transparent />
      </mesh>

      <Html center distanceFactor={labelStyle.distanceFactor} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div
          ref={labelRef}
          style={{
            color,
            fontSize: labelStyle.fontSize,
            fontWeight: labelTypography.fontWeight,
            fontVariationSettings: labelTypography.fontVariationSettings,
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            fontFamily: 'var(--font-family-app)',
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
