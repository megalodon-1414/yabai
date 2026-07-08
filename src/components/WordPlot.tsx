import { Html } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getBasicEmotion } from '../data/emotions';
import type { UserPlotRow } from '../types/userPlot';
import { getPrimaryEmotionColor, rowToEmotionParams } from '../utils/emotionPlotBridge';
import { getEmotionCenter } from '../utils/emotionSpaceLayout';
import { getAtmosphericAppearance, getPlotPointAppearance } from '../utils/plotAtmosphere';
import { isPureEmotionPlot, plotColorFromRow, plotPositionFromRow } from '../utils/plotFromUserPlot';
import { SELECTED_PLOT_SCALE, EXPLORATION_SELECTED_PLOT_SCALE } from '../utils/plotSelectionStyle';
import { getPlotLabelStyle, getPlotLabelTypography } from '../utils/plotLabelStyle';
import { OrbitTrail } from './OrbitTrail';

const VISIBILITY_LERP_SPEED = 6;
const VISIBILITY_INTERACTION_THRESHOLD = 0.08;
const EXPLORATION_DISTANT_VISIBILITY = 0.38;
const EXPLORATION_DISTANT_SCALE = 0.42;

interface WordPlotProps {
  plot: UserPlotRow;
  isSelected: boolean;
  isNearbyVisible: boolean;
  explorationMode?: boolean;
  onSelect: (wordId: string) => void;
}

export function WordPlot({
  plot,
  isSelected,
  isNearbyVisible,
  explorationMode = false,
  onSelect,
}: WordPlotProps) {
  const { size, camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const primaryLightRef = useRef<THREE.PointLight>(null);
  const secondaryLightRef = useRef<THREE.PointLight>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const worldPosition = useRef(new THREE.Vector3());
  const primaryLightPosition = useRef(new THREE.Vector3());
  const secondaryLightPosition = useRef(new THREE.Vector3());
  const primaryCenterPosition = useRef(new THREE.Vector3());
  const secondaryCenterPosition = useRef(new THREE.Vector3());
  const dynamicColor = useRef(new THREE.Color());
  const dynamicEmissive = useRef(new THREE.Color());
  const fadedColor = useRef(new THREE.Color());
  const labelFadedColor = useRef(new THREE.Color());
  const visibility = useRef(isNearbyVisible ? 1 : 0);
  const isOrbiting = isPureEmotionPlot(plot);

  const selectedScale = explorationMode && isSelected ? EXPLORATION_SELECTED_PLOT_SCALE : SELECTED_PLOT_SCALE;
  const showLabel = !explorationMode || isSelected;
  const isDistantExplorationPlot = explorationMode && !isNearbyVisible && !isSelected;
  const isSelectable = !explorationMode || isNearbyVisible || isSelected;

  const labelStyle = useMemo(
    () => getPlotLabelStyle(size.width, size.height, isSelected, selectedScale),
    [size.width, size.height, isSelected, selectedScale],
  );
  const labelTypography = useMemo(
    () => getPlotLabelTypography(plot, isSelected),
    [plot, isSelected],
  );
  const staticPosition = useMemo(() => plotPositionFromRow(plot), [plot]);
  const color = useMemo(() => plotColorFromRow(plot), [plot]);
  const emotionParams = useMemo(() => rowToEmotionParams(plot), [plot]);
  const primaryColor = useMemo(() => {
    const parsed = new THREE.Color();
    parsed.setStyle(getPrimaryEmotionColor(emotionParams.primaryId));
    return parsed;
  }, [emotionParams.primaryId]);
  const secondaryColor = useMemo(() => {
    const parsed = new THREE.Color();
    parsed.setStyle(getBasicEmotion(emotionParams.secondaryId).color);
    return parsed;
  }, [emotionParams.secondaryId]);
  const primaryCenter = useMemo(() => getEmotionCenter(emotionParams.primaryId), [emotionParams.primaryId]);
  const secondaryCenter = useMemo(() => getEmotionCenter(emotionParams.secondaryId), [emotionParams.secondaryId]);
  const baseColor = useMemo(() => {
    const parsed = new THREE.Color();
    parsed.setStyle(color);
    return parsed;
  }, [color]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    if (!group || !mesh) return;

    const [x, y, z] = isOrbiting
      ? plotPositionFromRow(plot, state.clock.elapsedTime)
      : staticPosition;
    group.position.set(x, y, z);

    const targetVisibility = isNearbyVisible || isSelected
      ? 1
      : explorationMode
        ? EXPLORATION_DISTANT_VISIBILITY
        : 0;
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
    const plotScale = isSelected ? selectedScale : isDistantExplorationPlot ? EXPLORATION_DISTANT_SCALE : 1;

    coreMaterial.opacity = finalOpacity;
    coreMaterial.transparent = true;
    coreMaterial.color.copy(appearance.color);
    coreMaterial.emissive.copy(appearance.color);
    coreMaterial.emissiveIntensity = appearance.emissiveIntensity;

    if (explorationMode && isSelected) {
      const pulse = (Math.sin(state.clock.elapsedTime * 1.35) + 1) / 2;
      dynamicColor.current.copy(primaryColor).lerp(secondaryColor, pulse * 0.42);
      dynamicEmissive.current.copy(appearance.color).lerp(dynamicColor.current, 0.55);
      coreMaterial.color.copy(appearance.color).lerp(dynamicColor.current, 0.38);
      coreMaterial.emissive.copy(dynamicEmissive.current);
      coreMaterial.emissiveIntensity = appearance.emissiveIntensity + 0.45 + pulse * 0.25;

      primaryCenterPosition.current.set(primaryCenter.x, primaryCenter.y, primaryCenter.z);
      primaryLightPosition.current.copy(primaryCenterPosition.current).sub(group.position).normalize().multiplyScalar(0.38);

      secondaryCenterPosition.current.set(secondaryCenter.x, secondaryCenter.y, secondaryCenter.z);
      secondaryLightPosition.current.copy(secondaryCenterPosition.current).sub(group.position).normalize().multiplyScalar(0.32);

      if (primaryLightRef.current) {
        primaryLightRef.current.position.copy(primaryLightPosition.current);
        primaryLightRef.current.color.copy(primaryColor);
        primaryLightRef.current.intensity = 1.1 + pulse * 0.35;
      }
      if (secondaryLightRef.current) {
        secondaryLightRef.current.position.copy(secondaryLightPosition.current);
        secondaryLightRef.current.color.copy(secondaryColor);
        secondaryLightRef.current.intensity = emotionParams.isPure ? 0 : 0.62 + (1 - pulse) * 0.2;
      }
    }
    mesh.scale.setScalar(plotScale);

    if (labelRef.current) {
      if (!showLabel) {
        labelRef.current.style.opacity = '0';
      } else {
        const labelOpacity = labelAppearance.opacity * visibilityFactor;
        labelRef.current.style.opacity = String(labelOpacity);
        labelRef.current.style.color = labelAppearance.color.getStyle();
        const shadowStrength = 0.15 + labelAppearance.opacity * 0.85;
        labelRef.current.style.textShadow = `0 0 ${8 * shadowStrength}px rgba(0,0,0,${0.9 * shadowStrength})`;
      }
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isSelectable || visibility.current < VISIBILITY_INTERACTION_THRESHOLD) {
      return;
    }

    event.stopPropagation();
    onSelect(plot.word_id);
  };

  return (
    <>
      {isOrbiting && (!explorationMode || isSelected) && (
        <OrbitTrail
          plot={plot}
          color={color}
          isSelected={isSelected}
          isNearbyVisible={isNearbyVisible}
          particleTrail={explorationMode && isSelected}
        />
      )}
      <group ref={groupRef} position={staticPosition}>
        {explorationMode && isSelected && (
          <>
            <pointLight ref={primaryLightRef} distance={1.4} decay={2} />
            {!emotionParams.isPure && <pointLight ref={secondaryLightRef} distance={1.1} decay={2} />}
          </>
        )}
        <mesh
          ref={meshRef}
          onClick={handleClick}
          onPointerOver={(event) => {
            if (!isSelectable || visibility.current < VISIBILITY_INTERACTION_THRESHOLD) {
              return;
            }

            event.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <sphereGeometry args={[0.044, 16, 16]} />
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
          {showLabel && (
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
          )}
        </Html>
      </group>
    </>
  );
}
