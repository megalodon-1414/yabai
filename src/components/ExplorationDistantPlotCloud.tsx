import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { UserPlotRow } from '../types/userPlot';
import { plotColorFromRow, plotPositionFromRow, type PlotOrbitOverrideMap } from '../utils/plotFromUserPlot';

interface ExplorationDistantPlotCloudProps {
  plots: UserPlotRow[];
  orbitOverrides?: PlotOrbitOverrideMap;
}

const DISTANT_PLOT_RADIUS = 0.012;

export function ExplorationDistantPlotCloud({ plots, orbitOverrides }: ExplorationDistantPlotCloudProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const hasOrbitingPlots = plots.some((plot) => orbitOverrides?.has(plot.word_id));

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    plots.forEach((plot, index) => {
      const [x, y, z] = plotPositionFromRow(plot, 0, orbitOverrides?.get(plot.word_id));
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      color.setStyle(plotColorFromRow(plot));
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [color, dummy, orbitOverrides, plots]);

  useFrame((state) => {
    if (!hasOrbitingPlots) return;
    const mesh = meshRef.current;
    if (!mesh) return;

    plots.forEach((plot, index) => {
      const orbitOverride = orbitOverrides?.get(plot.word_id);
      if (!orbitOverride) return;

      const [x, y, z] = plotPositionFromRow(plot, state.clock.elapsedTime, orbitOverride);
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  if (plots.length === 0) {
    return null;
  }

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, plots.length]} frustumCulled={false}>
      <sphereGeometry args={[DISTANT_PLOT_RADIUS, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.58} depthWrite={false} vertexColors toneMapped={false} />
    </instancedMesh>
  );
}
