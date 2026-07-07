import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getAllEmotionCenters, getEmotionSphereRadius } from '../utils/emotionSpaceLayout';
import { isBasicEmotionId } from '../data/emotions';

const SPACE_FOG_COLOR = '#030508';
const AREA_ATMOSPHERE_NEAR = 5;
const AREA_ATMOSPHERE_FAR = 24;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

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
  radius: number;
  isBasic: boolean;
}

function EmotionSphere({ position, color, radius, isBasic }: EmotionSphereProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const worldPosition = useRef(new THREE.Vector3());
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const fogColor = useMemo(() => new THREE.Color(SPACE_FOG_COLOR), []);
  const emissive = useMemo(() => new THREE.Color(color), [color]);

  const baseStyle = useMemo(
    () =>
      isBasic
        ? { mainOpacity: 0.24, glowOpacity: 0.07, innerOpacity: 0.13, emissiveIntensity: 0.55 }
        : { mainOpacity: 0.13, glowOpacity: 0.035, innerOpacity: 0, emissiveIntensity: 0.28 },
    [isBasic],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 0.6 + position[0]) * 0.03;

    if (meshRef.current) meshRef.current.scale.setScalar(pulse);
    if (glowRef.current) glowRef.current.scale.setScalar(pulse * 1.18);
    if (innerRef.current) innerRef.current.scale.setScalar(pulse);

    const group = groupRef.current;
    const mesh = meshRef.current;
    const glow = glowRef.current;
    const inner = innerRef.current;
    if (!group || !mesh || !glow) return;

    group.getWorldPosition(worldPosition.current);
    const distance = camera.position.distanceTo(worldPosition.current);
    const fade = smoothstep(AREA_ATMOSPHERE_NEAR, AREA_ATMOSPHERE_FAR, distance);

    const mainMaterial = mesh.material as THREE.MeshStandardMaterial;
    const glowMaterial = glow.material as THREE.MeshBasicMaterial;
    const mainOpacity = THREE.MathUtils.lerp(baseStyle.mainOpacity, baseStyle.mainOpacity * 0.12, fade);
    const glowOpacity = THREE.MathUtils.lerp(baseStyle.glowOpacity, 0.008, fade);
    const colorMix = fade * 0.88;

    mainMaterial.opacity = mainOpacity;
    mainMaterial.emissiveIntensity = THREE.MathUtils.lerp(
      baseStyle.emissiveIntensity,
      baseStyle.emissiveIntensity * 0.15,
      fade,
    );
    mainMaterial.color.copy(baseColor).lerp(fogColor, colorMix);
    mainMaterial.emissive.copy(emissive).lerp(fogColor, colorMix * 0.9);

    glowMaterial.opacity = glowOpacity;
    glowMaterial.color.copy(baseColor).lerp(fogColor, colorMix);

    if (inner) {
      const innerMaterial = inner.material as THREE.MeshBasicMaterial;
      const innerOpacity = THREE.MathUtils.lerp(baseStyle.innerOpacity, baseStyle.innerOpacity * 0.1, fade);
      innerMaterial.opacity = innerOpacity;
      innerMaterial.color.copy(baseColor).lerp(fogColor, colorMix);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius * 1.18, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={baseStyle.glowOpacity} depthWrite={false} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={baseStyle.emissiveIntensity}
          transparent
          opacity={baseStyle.mainOpacity}
          roughness={0.4}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>
      {isBasic && (
        <mesh ref={innerRef}>
          <sphereGeometry args={[radius * 0.38, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={baseStyle.innerOpacity} depthWrite={false} />
        </mesh>
      )}
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
          radius={getEmotionSphereRadius(area.id)}
          isBasic={isBasicEmotionId(area.id)}
        />
      ))}
    </group>
  );
}
