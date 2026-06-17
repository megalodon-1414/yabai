import { useMemo } from 'react';
import {
  ATMOSPHERE_FAR_DISTANCE,
  ATMOSPHERE_MIN_OPACITY,
  ATMOSPHERE_NEAR_DISTANCE,
} from '../utils/plotAtmosphere';
import { buildEmotionSpaceDotsGeometry, emotionSpaceDotShaders } from '../utils/emotionSpaceDots';

const DEFAULT_DOT_SIZE = 0.04;

interface SpaceDots3DProps {
  currentMode: 'emotion' | 'state';
  dotSize?: number;
}

export function SpaceDots3D({ currentMode, dotSize = DEFAULT_DOT_SIZE }: SpaceDots3DProps) {
  const geometry = useMemo(() => buildEmotionSpaceDotsGeometry(), []);

  const uniforms = useMemo(
    () => ({
      size: { value: dotSize * (typeof window !== 'undefined' ? window.devicePixelRatio : 1) },
      nearDistance: { value: ATMOSPHERE_NEAR_DISTANCE },
      farDistance: { value: ATMOSPHERE_FAR_DISTANCE },
      minCameraOpacity: { value: ATMOSPHERE_MIN_OPACITY },
    }),
    [dotSize],
  );

  if (currentMode !== 'emotion') {
    return null;
  }

  return (
    <points geometry={geometry}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={emotionSpaceDotShaders.vertexShader}
        fragmentShader={emotionSpaceDotShaders.fragmentShader}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
