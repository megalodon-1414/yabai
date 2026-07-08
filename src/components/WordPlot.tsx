import { Html } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { UserPlotRow } from '../types/userPlot';
import { getAtmosphericAppearance, getPlotPointAppearance } from '../utils/plotAtmosphere';
import { isPureEmotionPlot, plotColorFromRow, plotPositionFromRow } from '../utils/plotFromUserPlot';
import { SELECTED_PLOT_SCALE } from '../utils/plotSelectionStyle';
import { getPlotLabelStyle, getPlotLabelTypography } from '../utils/plotLabelStyle';
import { OrbitTrail } from './OrbitTrail';

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
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const worldPosition = useRef(new THREE.Vector3());
  const fadedColor = useRef(new THREE.Color());
  const labelFadedColor = useRef(new THREE.Color());
  const visibility = useRef(isNearbyVisible ? 1 : 0);
  const isVisible = plot.mode === currentMode;
  const isOrbiting = plot.mode === 'emotion' && isPureEmotionPlot(plot);

  const labelStyle = useMemo(
    () => getPlotLabelStyle(size.width, size.height, isSelected),
    [size.width, size.height, isSelected],
  );
  const labelTypography = useMemo(
    () => getPlotLabelTypography(plot, isSelected),
    [plot, isSelected],
  );
  const staticPosition = useMemo(() => plotPositionFromRow(plot), [plot]);
  const color = useMemo(() => plotColorFromRow(plot), [plot]);
  const baseColor = useMemo(() => {
    const parsed = new THREE.Color();
    parsed.setStyle(color);
    return parsed;
  }, [color]);

  useFrame((state, delta) => {
    if (!isVisible) return;

    const group = groupRef.current;
    const mesh = meshRef.current;
    if (!group || !mesh) return;

    const [x, y, z] = isOrbiting
      ? plotPositionFromRow(plot, state.clock.elapsedTime)
      : staticPosition;
    group.position.set(x, y, z);

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
    const appearance = getPlotPointAppearance(distance, baseColor, isSelected, fadedColor.current);
    const labelAppearance = getAtmosphericAppearance(
      distance,
      baseColor,
      isSelected,
      labelFadedColor.current,
    );
    const coreMaterial = mesh.material as THREE.MeshStandardMaterial;
    const finalOpacity = appearance.opacity * visibilityFactor;
    const plotScale = isSelected ? SELECTED_PLOT_SCALE : 1;

    coreMaterial.opacity = finalOpacity;
    coreMaterial.transparent = true;
    coreMaterial.color.copy(appearance.color);
    coreMaterial.emissive.copy(appearance.color);
    coreMaterial.emissiveIntensity = appearance.emissiveIntensity;
    mesh.scale.setScalar(plotScale);

    if (labelRef.current) {
      const labelOpacity = labelAppearance.opacity * visibilityFactor;
      labelRef.current.style.opacity = String(labelOpacity);
      labelRef.current.style.color = labelAppearance.color.getStyle();
      const shadowStrength = 0.15 + labelAppearance.opacity * 0.85;
      labelRef.current.style.textShadow = `0 0 ${8 * shadowStrength}px rgba(0,0,0,${0.9 * shadowStrength})`;
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
    <>
      {isOrbiting && (
        <OrbitTrail
          plot={plot}
          color={color}
          isSelected={isSelected}
          isNearbyVisible={isNearbyVisible}
        />
      )}
      <group ref={groupRef} position={staticPosition}>
        <mesh
          ref={meshRef}
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
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.05}
            transparent
            opacity={1}
            roughness={0.2}
            metalness={0}
            toneMapped={false}
          />
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
    </>
  );
}
