import { Html } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { UserPlotRow } from '../types/userPlot';
import { getPrimaryEmotionColor, rowToEmotionParams } from '../utils/emotionPlotBridge';
import { getEmotionCenter } from '../utils/emotionSpaceLayout';
import { getAtmosphericAppearance, getPlotPointAppearance } from '../utils/plotAtmosphere';
import {
  isPureEmotionPlot,
  plotColorFromRow,
  plotPositionFromRow,
  type PlotOrbitOverride,
} from '../utils/plotFromUserPlot';
import { SELECTED_PLOT_SCALE } from '../utils/plotSelectionStyle';
import { getPlotLabelStyle, getPlotLabelTypography, FLOW_LABEL_DURATION_MS, getFlowLabelFadeFactor, type PlotLabelDisplayMode } from '../utils/plotLabelStyle';
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
  flowLabelExpiresAt?: Readonly<Record<string, number>>;
  flowLabelNow?: number;
  plotLabelDisplayMode?: PlotLabelDisplayMode;
  orbitOverride?: PlotOrbitOverride;
  orbitTimeScale?: number;
  onHoverChange?: (wordId: string | null) => void;
  onSelect: (wordId: string) => void;
}

export function WordPlot({
  plot,
  isSelected,
  isNearbyVisible,
  explorationMode = false,
  flowLabelExpiresAt,
  flowLabelNow = 0,
  plotLabelDisplayMode = 'flow',
  orbitOverride,
  orbitTimeScale = 1,
  onHoverChange,
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

  const selectedScale = explorationMode && isSelected ? 1 : SELECTED_PLOT_SCALE;
  const flowExpiresAt = flowLabelExpiresAt?.[plot.word_id];
  const isFlowLabelActive = flowExpiresAt !== undefined && flowExpiresAt > flowLabelNow;
  const showLabel = !explorationMode
    || (plotLabelDisplayMode === 'nearby' && isNearbyVisible)
    || (plotLabelDisplayMode === 'flow' && (isSelected || isFlowLabelActive));
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
  const staticPosition = useMemo(() => plotPositionFromRow(plot, 0, orbitOverride), [plot, orbitOverride]);
  const color = useMemo(() => plotColorFromRow(plot), [plot]);
  const emotionParams = useMemo(() => rowToEmotionParams(plot), [plot]);
  const primaryColor = useMemo(() => {
    const parsed = new THREE.Color();
    parsed.setStyle(getPrimaryEmotionColor(emotionParams.primaryId));
    return parsed;
  }, [emotionParams.primaryId]);
  const secondaryColor = useMemo(() => {
    const parsed = new THREE.Color();
    parsed.setStyle(getPrimaryEmotionColor(emotionParams.secondaryId));
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

    const orbitTime = state.clock.elapsedTime * orbitTimeScale;
    const [x, y, z] = isOrbiting || orbitOverride
      ? plotPositionFromRow(plot, orbitTime, orbitOverride)
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

    if (explorationMode && isSelected && !isOrbiting) {
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
        const flowFadeFactor = plotLabelDisplayMode === 'flow' && !isSelected && explorationMode && flowExpiresAt
          ? getFlowLabelFadeFactor(flowExpiresAt, Date.now(), FLOW_LABEL_DURATION_MS)
          : 1;
        const labelOpacity = labelAppearance.opacity * visibilityFactor * flowFadeFactor;
        const shadowStrength = 0.15 + labelAppearance.opacity * 0.85;

        labelRef.current.style.opacity = String(labelOpacity);
        labelRef.current.style.color = labelAppearance.color.getStyle();
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
      {(isOrbiting && (!explorationMode || isSelected)) || (explorationMode && orbitOverride) ? (
        <OrbitTrail
          plot={plot}
          color={color}
          isSelected={isSelected}
          isNearbyVisible={isNearbyVisible}
          particleTrail={explorationMode && (isSelected || Boolean(orbitOverride))}
          selectedParticleTrail={explorationMode && isSelected && isOrbiting}
          subtleParticleTrail={Boolean(orbitOverride)}
          orbitOverride={orbitOverride}
          orbitTimeScale={orbitTimeScale}
        />
      ) : null}
      <group ref={groupRef} position={staticPosition}>
        {explorationMode && isSelected && !isOrbiting && (
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
            onHoverChange?.(plot.word_id);
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
            onHoverChange?.(null);
          }}
        >
          <sphereGeometry args={[0.032, 12, 12]} />
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

        {showLabel && (
          <Html center distanceFactor={labelStyle.distanceFactor} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div
              ref={labelRef}
              style={{
                fontSize: labelStyle.fontSize,
                fontWeight: labelTypography.fontWeight,
                writingMode: 'vertical-rl',
                textOrientation: 'upright',
                fontFamily: 'var(--font-family-app)',
                transform: `translateY(calc(50% + ${labelStyle.screenOffsetY}px))`,
              }}
            >
              {plot.word_id}
            </div>
          </Html>
        )}
      </group>
    </>
  );
}
