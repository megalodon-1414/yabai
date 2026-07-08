import { useMemo } from 'react';
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

interface EmotionPointCloudProps {
  position: [number, number, number];
  color: string;
  radius: number;
  isBasic: boolean;
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

function EmotionPointCloud({ position, color, radius, isBasic }: EmotionPointCloudProps) {
  const points = useMemo(() => createRadialGridPoints(radius, isBasic), [radius, isBasic]);
  const pointSize = isBasic ? 0.012 : 0.009;
  const opacity = isBasic ? 0.9 : 0.72;

  return (
    <points position={position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={pointSize}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

interface EmotionCenterPointProps {
  position: [number, number, number];
  color: string;
  isBasic: boolean;
}

function EmotionCenterPoint({ position, color, isBasic }: EmotionCenterPointProps) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[isBasic ? 0.022 : 0.016, 6, 6]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={isBasic ? 0.95 : 0.78}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
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
      {areas.map((area) => (
        <group key={area.id}>
          <EmotionPointCloud
            position={[area.position.x, area.position.y, area.position.z]}
            color={area.color}
            radius={getEmotionSphereRadius(area.id)}
            isBasic={isBasicEmotionId(area.id)}
          />
          <EmotionCenterPoint
            position={[area.position.x, area.position.y, area.position.z]}
            color={area.color}
            isBasic={isBasicEmotionId(area.id)}
          />
        </group>
      ))}
    </group>
  );
}
