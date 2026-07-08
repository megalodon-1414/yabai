import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as THREE from 'three';
import type { UserPlotRow } from '../types/userPlot';
import { getAtmosphericAppearance } from '../utils/plotAtmosphere';
import { getPureOrbitRingPoints } from '../utils/emotionPlotPosition';
import { legacyRowToEmotionParams } from '../utils/legacyEmotionBridge';

const ORBIT_LINE_WIDTH = 10;

interface OrbitTrailProps {
  plot: UserPlotRow;
  color: string;
  isSelected: boolean;
  isNearbyVisible: boolean;
}

export function OrbitTrail({ plot, color, isSelected, isNearbyVisible }: OrbitTrailProps) {
  const { camera, size } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const worldPosition = useRef(new THREE.Vector3());
  const fadedColor = useRef(new THREE.Color());
  const visibility = useRef(isNearbyVisible ? 1 : 0);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const trailMesh = useMemo(() => {
    const params = legacyRowToEmotionParams(plot);
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
