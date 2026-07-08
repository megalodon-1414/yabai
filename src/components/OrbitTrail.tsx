import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as THREE from 'three';
import type { UserPlotRow } from '../types/userPlot';
import { getAtmosphericAppearance } from '../utils/plotAtmosphere';
import { getPureOrbitRingPoints } from '../utils/emotionPlotPosition';
import { rowToEmotionParams } from '../utils/emotionPlotBridge';
import { plotPositionFromRow } from '../utils/plotFromUserPlot';

const ORBIT_LINE_WIDTH = 10;
const PARTICLE_TRAIL_COUNT = 30;
const PARTICLE_TRAIL_STEP_SECONDS = 0.28;

interface OrbitTrailProps {
  plot: UserPlotRow;
  color: string;
  isSelected: boolean;
  isNearbyVisible: boolean;
  particleTrail?: boolean;
}

function OrbitParticleTrail({ plot, color }: Pick<OrbitTrailProps, 'plot' | 'color'>) {
  const groupRef = useRef<THREE.Group>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const particleIndexes = useMemo(
    () => Array.from({ length: PARTICLE_TRAIL_COUNT }, (_, index) => index),
    [],
  );

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    for (let i = 0; i < group.children.length; i += 1) {
      const child = group.children[i];
      const age = i * PARTICLE_TRAIL_STEP_SECONDS;
      child.position.set(...plotPositionFromRow(plot, state.clock.elapsedTime - age));
      child.scale.setScalar(1 - i / PARTICLE_TRAIL_COUNT * 0.72);
    }
  });

  return (
    <group ref={groupRef}>
      {particleIndexes.map((index) => (
        <mesh key={index}>
          <sphereGeometry args={[0.0075, 6, 6]} />
          <meshBasicMaterial
            color={baseColor}
            transparent
            opacity={1 - index / PARTICLE_TRAIL_COUNT * 0.84}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function OrbitTrail({
  plot,
  color,
  isSelected,
  isNearbyVisible,
  particleTrail = false,
}: OrbitTrailProps) {
  const { camera, size } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const worldPosition = useRef(new THREE.Vector3());
  const fadedColor = useRef(new THREE.Color());
  const visibility = useRef(isNearbyVisible ? 1 : 0);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  if (particleTrail) {
    return <OrbitParticleTrail plot={plot} color={color} />;
  }

  const trailMesh = useMemo(() => {
    const params = rowToEmotionParams(plot);
    const points = getPureOrbitRingPoints(params, plot.word_id);
    if (!points) return null;

    const geometry = new MeshLineGeometry();
    geometry.setPoints(points);

    const material = new MeshLineMaterial({
      color: new THREE.Color(color),
      lineWidth: ORBIT_LINE_WIDTH,
      opacity: 0.32,
      sizeAttenuation: 0,
      resolution: new THREE.Vector2(size.width, size.height),
    });
    material.transparent = true;
    material.depthWrite = false;

    return new THREE.Mesh(geometry, material);
  }, [plot, color, size.width, size.height]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const targetVisibility = isNearbyVisible ? 1 : 0;
    const t = 1 - Math.exp(-6 * delta);
    visibility.current = THREE.MathUtils.lerp(visibility.current, targetVisibility, t);

    const visibilityFactor = visibility.current;
    mesh.visible = visibilityFactor > 0.01;
    if (!mesh.visible) return;

    mesh.getWorldPosition(worldPosition.current);
    const distance = camera.position.distanceTo(worldPosition.current);
    const appearance = getAtmosphericAppearance(distance, baseColor, isSelected, fadedColor.current);
    const material = mesh.material as MeshLineMaterial;
    const trailOpacity = (isSelected ? 0.55 : 0.32) * appearance.opacity * visibilityFactor;

    material.resolution.set(size.width, size.height);
    material.opacity = trailOpacity;
    material.color.copy(appearance.color);
  });

  if (!trailMesh) {
    return null;
  }

  return <primitive ref={meshRef} object={trailMesh} />;
}
