import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { EMOTION_HUES, EMOTION_LABELS, PRIMARY_EMOTIONS } from '../emotionSpace/emotions';
import { primaryEmotionPosition } from '../emotionSpace/geometry';

const CORE_RADIUS = 0.1;
const GLOW_RADIUS = 0.38;

export function EmotionGalaxyCenters() {
  return (
    <>
      {PRIMARY_EMOTIONS.map((emotion) => {
        const position = primaryEmotionPosition(emotion);
        const color = `hsl(${EMOTION_HUES[emotion]}, 72%, 58%)`;

        return (
          <group key={emotion} position={position}>
            <mesh renderOrder={0}>
              <sphereGeometry args={[GLOW_RADIUS, 20, 20]} />
              <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
            </mesh>
            <mesh renderOrder={1}>
              <sphereGeometry args={[CORE_RADIUS, 16, 16]} />
              <meshBasicMaterial color={color} transparent opacity={0.92} />
            </mesh>
            <mesh renderOrder={1} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[CORE_RADIUS * 1.35, CORE_RADIUS * 1.85, 32]} />
              <meshBasicMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} />
            </mesh>

            <Html
              center
              distanceFactor={10}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div
                style={{
                  color,
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-family-app)',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                  textShadow: '0 0 10px rgba(0,0,0,0.95), 0 0 18px currentColor',
                  transform: 'translateY(-28px)',
                }}
              >
                {EMOTION_LABELS[emotion]}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
