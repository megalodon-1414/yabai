import { useMemo } from 'react';
import * as THREE from 'three';
import { getAllEmotionCenters, getEmotionSphereRadius } from '../utils/emotionSpaceLayout';
import { isBasicEmotionId } from '../data/emotions';

function StarField() {
  const points = useMemo(() => {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 40 + Math.random() * 60;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    return positions;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#c8d6e5" transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

function SparseVoidPoints() {
  const points = useMemo(() => {
    const count = 260;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 10 + Math.random() * 22;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }

    return positions;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.012}
        color="#ffffff"
        transparent
        opacity={0.34}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function createRadialGridPoints(radius: number, isBasic: boolean): Float32Array {
  const directionCount = isBasic ? 56 : 30;
  const radialSteps = isBasic ? 5 : 4;
  const positions = new Float32Array(directionCount * radialSteps * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  let cursor = 0;

  for (let i = 0; i < directionCount; i += 1) {
    const y = 1 - (i / Math.max(1, directionCount - 1)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * goldenAngle;
    const x = Math.cos(theta) * ringRadius;
    const z = Math.sin(theta) * ringRadius;

    for (let step = 1; step <= radialSteps; step += 1) {
      const normalized = step / radialSteps;
      const distance = radius * (0.28 + normalized * 0.9);
      positions[cursor] = x * distance;
      positions[cursor + 1] = y * distance;
      positions[cursor + 2] = z * distance;
      cursor += 3;
    }
  }

  return positions;
}

interface CombinedEmotionPointCloudProps {
  areas: ReturnType<typeof getAllEmotionCenters>;
}

function CombinedEmotionPointCloud({ areas }: CombinedEmotionPointCloudProps) {
  const { positions, colors } = useMemo(() => {
    const positionValues: number[] = [];
    const colorValues: number[] = [];
    const color = new THREE.Color();

    for (const area of areas) {
      const basic = isBasicEmotionId(area.id);
      const localPoints = createRadialGridPoints(getEmotionSphereRadius(area.id), basic);
      color.setStyle(area.color);

      for (let i = 0; i < localPoints.length; i += 3) {
        positionValues.push(
          area.position.x + localPoints[i],
          area.position.y + localPoints[i + 1],
          area.position.z + localPoints[i + 2],
        );
        colorValues.push(color.r, color.g, color.b);
      }

      positionValues.push(area.position.x, area.position.y, area.position.z);
      colorValues.push(color.r, color.g, color.b);
    }

    return {
      positions: new Float32Array(positionValues),
      colors: new Float32Array(colorValues),
    };
  }, [areas]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.011}
        transparent
        opacity={0.82}
        depthWrite={false}
        sizeAttenuation
        toneMapped={false}
        vertexColors
      />
    </points>
  );
}

interface EmotionSpaceAreasProps {
  visible?: boolean;
  lite?: boolean;
}

export function EmotionSpaceAreas({ visible = true, lite = false }: EmotionSpaceAreasProps) {
  const areas = useMemo(() => getAllEmotionCenters(), []);

  if (!visible) {
    return null;
  }

  return (
    <group>
      {!lite && <StarField />}
      <SparseVoidPoints />
      <ambientLight intensity={lite ? 0.4 : 0.35} />
      {!lite && (
        <>
          <pointLight position={[8, 6, 10]} intensity={1.2} color="#a8c8ff" />
          <pointLight position={[-6, -4, -8]} intensity={0.6} color="#ff9eb5" />
        </>
      )}
      <CombinedEmotionPointCloud areas={areas} />
    </group>
  );
}
