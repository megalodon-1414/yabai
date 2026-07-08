import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getBasicEmotion, isBasicEmotionId } from '../data/emotions';
import type { UserPlotRow } from '../types/userPlot';
import { getPrimaryEmotionColor, rowToEmotionParams } from '../utils/emotionPlotBridge';
import { getEmotionCenter } from '../utils/emotionSpaceLayout';
import { plotPositionFromRow } from '../utils/plotFromUserPlot';

interface GravityAttractionParticlesProps {
  plot: UserPlotRow;
}

interface GravityStreamProps {
  plot: UserPlotRow;
  target: [number, number, number];
  color: string;
  particleCount: number;
  particleSize: number;
  speed: number;
  sourceSpread?: number;
  waveAmplitude?: number;
  waveFrequency?: number;
  reach?: number;
  phaseOffset?: number;
}

function GravityStream({
  plot,
  target,
  color,
  particleCount,
  particleSize,
  speed,
  sourceSpread = 0,
  waveAmplitude = 0,
  waveFrequency = 1,
  reach = 1,
  phaseOffset = 0,
}: GravityStreamProps) {
  const groupRef = useRef<THREE.Group>(null);
  const start = useRef(new THREE.Vector3());
  const end = useMemo(() => new THREE.Vector3(...target), [target]);
  const temp = useRef(new THREE.Vector3());
  const spread = useRef(new THREE.Vector3());
  const wave = useRef(new THREE.Vector3());
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const particleIndexes = useMemo(
    () => Array.from({ length: particleCount }, (_, index) => index),
    [particleCount],
  );
  const spreadDirections = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, index) => {
        const angle = index * 2.399963229728653;
        const y = 1 - (index / Math.max(1, particleCount - 1)) * 2;
        const radius = Math.sqrt(Math.max(0, 1 - y * y));
        return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      }),
    [particleCount],
  );

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    start.current.set(...plotPositionFromRow(plot, state.clock.elapsedTime));

    for (let i = 0; i < group.children.length; i += 1) {
      const particle = group.children[i];
      const progress = (state.clock.elapsedTime * speed + i / particleCount + phaseOffset) % 1;
      const eased = progress * progress * (3 - 2 * progress);
      const reached = eased * reach;
      temp.current.copy(start.current).lerp(end, reached);
      if (sourceSpread > 0) {
        const convergence = Math.pow(1 - progress, 2.8);
        const spreadAmount = sourceSpread * convergence * (0.45 + Math.sin(progress * Math.PI) * 0.35);
        spread.current.copy(spreadDirections[i]).multiplyScalar(spreadAmount);
        temp.current.add(spread.current);
      }
      if (waveAmplitude > 0) {
        const wavePhase = progress * Math.PI * 2 * waveFrequency + i * 0.55;
        const waveAmount = Math.sin(wavePhase) * waveAmplitude * Math.sin(progress * Math.PI) * Math.pow(1 - progress * 0.75, 2);
        wave.current.copy(spreadDirections[(i * 7) % particleCount]).multiplyScalar(waveAmount);
        temp.current.add(wave.current);
      }
      particle.position.copy(temp.current);

      const pulse = Math.sin(progress * Math.PI);
      particle.scale.setScalar(0.28 + pulse * 0.36);
    }
  });

  return (
    <group ref={groupRef}>
      {particleIndexes.map((index) => (
        <mesh key={index}>
          <sphereGeometry args={[particleSize, 6, 6]} />
          <meshBasicMaterial
            color={baseColor}
            transparent={false}
            opacity={1}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function vecToTuple(vec: { x: number; y: number; z: number }): [number, number, number] {
  return [vec.x, vec.y, vec.z];
}

export function GravityAttractionParticles({ plot }: GravityAttractionParticlesProps) {
  const params = rowToEmotionParams(plot);
  const primaryCenter = getEmotionCenter(params.primaryId);
  const secondaryCenter = getEmotionCenter(params.secondaryId);
  const showSecondary = !(isBasicEmotionId(params.primaryId) && params.primaryId === params.secondaryId);

  return (
    <>
      <GravityStream
        plot={plot}
        target={vecToTuple(primaryCenter)}
        color={getPrimaryEmotionColor(params.primaryId)}
        particleCount={132}
        particleSize={0.0042}
        speed={0.11}
        sourceSpread={0.34}
        waveAmplitude={0.032}
        waveFrequency={4.2}
        reach={0.56}
      />
      {showSecondary && (
        <GravityStream
          plot={plot}
          target={vecToTuple(secondaryCenter)}
          color={getBasicEmotion(params.secondaryId).color}
          particleCount={30}
          particleSize={0.006}
          speed={0.12}
          sourceSpread={0.11}
          waveAmplitude={0.028}
          waveFrequency={2.6}
          phaseOffset={0.38}
        />
      )}
    </>
  );
}
