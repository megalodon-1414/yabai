import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getAllEmotionCenters, EMOTION_SPHERE_RADIUS } from '../utils/emotionSpaceLayout';
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

interface EmotionSphereProps {
  position: [number, number, number];
  color: string;
  isBasic: boolean;
}

function EmotionSphere({ position, color, isBasic }: EmotionSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 0.6 + position[0]) * 0.03;
    if (meshRef.current) {
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(pulse * 1.18);
    }
  });

  const emissive = useMemo(() => new THREE.Color(color), [color]);

  return (
    <group position={position}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[EMOTION_SPHERE_RADIUS * 1.18, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.06} depthWrite={false} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[EMOTION_SPHERE_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={isBasic ? 0.55 : 0.35}
          transparent
          opacity={isBasic ? 0.22 : 0.16}
          roughness={0.4}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[EMOTION_SPHERE_RADIUS * (isBasic ? 0.38 : 0), 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={isBasic ? 0.12 : 0} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface EmotionSpaceAreasProps {
  currentMode: 'emotion' | 'state';
}

export function EmotionSpaceAreas({ currentMode }: EmotionSpaceAreasProps) {
  const areas = useMemo(() => getAllEmotionCenters(), []);

  if (currentMode !== 'emotion') {
    return null;
  }

  return (
    <group>
      <StarField />
      <ambientLight intensity={0.35} />
      <pointLight position={[8, 6, 10]} intensity={1.2} color="#a8c8ff" />
      <pointLight position={[-6, -4, -8]} intensity={0.6} color="#ff9eb5" />
      {areas.map((area) => (
        <EmotionSphere
          key={area.id}
          position={[area.position.x, area.position.y, area.position.z]}
          color={area.color}
          isBasic={isBasicEmotionId(area.id)}
        />
      ))}
    </group>
  );
}
