import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { UserPlotRow } from '../types/userPlot';
import {
  plotColorFromRow,
  plotPositionFromRow,
  type PlotOrbitOverrideMap,
} from '../utils/plotFromUserPlot';

interface ExplorationDistantPlotCloudProps {
  plots: UserPlotRow[];
  orbitOverrides?: PlotOrbitOverrideMap;
}

const DISTANT_POINT_SIZE = 0.18;
const DISTANT_COLOR_BOOST = 0.18;
const OPACITY_MIN = 0.28;
const OPACITY_MAX = 0.88;
const DISTANCE_OPACITY_NEAR = 3.5;
const DISTANCE_OPACITY_FAR = 14;

function getDistanceOpacity(distance: number): number {
  const t = THREE.MathUtils.smoothstep(distance, DISTANCE_OPACITY_NEAR, DISTANCE_OPACITY_FAR);
  return THREE.MathUtils.lerp(OPACITY_MIN, OPACITY_MAX, t);
}

const distantPointMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  toneMapped: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uSize: { value: DISTANT_POINT_SIZE },
  },
  vertexShader: `
    attribute float aOpacity;
    attribute vec3 color;
    varying vec3 vColor;
    varying float vOpacity;
    uniform float uSize;

    void main() {
      vColor = color;
      vOpacity = aOpacity;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = uSize * (300.0 / max(-mvPosition.z, 0.001));
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vOpacity;

    void main() {
      vec2 centered = gl_PointCoord - vec2(0.5);
      float dist = length(centered);
      if (dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.16, dist) * vOpacity;
      gl_FragColor = vec4(vColor, alpha);
    }
  `,
});

export function ExplorationDistantPlotCloud({ plots, orbitOverrides }: ExplorationDistantPlotCloudProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(Math.max(plots.length, 1) * 3), [plots.length]);
  const colors = useMemo(() => new Float32Array(Math.max(plots.length, 1) * 3), [plots.length]);
  const opacities = useMemo(() => new Float32Array(Math.max(plots.length, 1)), [plots.length]);
  const color = useMemo(() => new THREE.Color(), []);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const geometry = pointsRef.current?.geometry;
    if (!geometry) return;

    plots.forEach((plot, index) => {
      color.setStyle(plotColorFromRow(plot));
      color.lerp(new THREE.Color('#ffffff'), DISTANT_COLOR_BOOST);
      const offset = index * 3;
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    });

    geometry.attributes.color.needsUpdate = true;
  }, [color, colors, plots]);

  useFrame((state) => {
    const geometry = pointsRef.current?.geometry;
    if (!geometry) return;

    const cameraPosition = state.camera.position;

    plots.forEach((plot, index) => {
      const [x, y, z] = plotPositionFromRow(plot, state.clock.elapsedTime, orbitOverrides?.get(plot.word_id));
      const offset = index * 3;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;

      worldPosition.set(x, y, z);
      opacities[index] = getDistanceOpacity(cameraPosition.distanceTo(worldPosition));
    });

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aOpacity.needsUpdate = true;
  });

  if (plots.length === 0) {
    return null;
  }

  return (
    <points ref={pointsRef} frustumCulled={false} material={distantPointMaterial}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
      </bufferGeometry>
    </points>
  );
}
