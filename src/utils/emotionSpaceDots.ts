import * as THREE from 'three';
import { emotionPositionFromParams } from './plotFromUserPlot';

const DEFAULT_HUE_STEP = 20;
const DEFAULT_SATURATION_STEP = 20;
const DEFAULT_BRIGHTNESS_STEP = 10;
const DOT_SATURATION_MAX = 120;
const DOT_BRIGHTNESS_MIN = 15;
const DOT_BRIGHTNESS_MAX = 95;
const MIN_ALPHA = 0.06;
const MAX_ALPHA = 0.42;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function alphaFromCenterDistance(x: number, y: number, z: number, maxDistance: number): number {
  const distance = Math.hypot(x, y, z);
  const fade = smoothstep(0, maxDistance, distance);
  return THREE.MathUtils.lerp(MAX_ALPHA, MIN_ALPHA, fade);
}

interface EmotionSpaceDotsOptions {
  hueStep?: number;
  saturationStep?: number;
  brightnessStep?: number;
}

export function buildEmotionSpaceDotsGeometry(
  {
    hueStep = DEFAULT_HUE_STEP,
    saturationStep = DEFAULT_SATURATION_STEP,
    brightnessStep = DEFAULT_BRIGHTNESS_STEP,
  }: EmotionSpaceDotsOptions = {},
): THREE.BufferGeometry {
  const positions: number[] = [];
  const alphas: number[] = [];

  const maxDistance = (() => {
    const [x, y, z] = emotionPositionFromParams(0, DOT_SATURATION_MAX, DOT_BRIGHTNESS_MAX);
    return Math.hypot(x, y, z);
  })();

  for (let hue = 0; hue < 360; hue += hueStep) {
    for (let saturation = 0; saturation <= DOT_SATURATION_MAX; saturation += saturationStep) {
      for (let brightness = DOT_BRIGHTNESS_MIN; brightness <= DOT_BRIGHTNESS_MAX; brightness += brightnessStep) {
        const [x, y, z] = emotionPositionFromParams(hue, saturation, brightness);
        positions.push(x, y, z);
        alphas.push(alphaFromCenterDistance(x, y, z, maxDistance));
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));
  return geometry;
}

export const emotionSpaceDotShaders = {
  vertexShader: `
    attribute float alpha;
    varying float vAlpha;
    uniform float size;
    uniform float nearDistance;
    uniform float farDistance;
    uniform float minCameraOpacity;

    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float cameraDistance = length(mvPosition.xyz);
      float cameraFade = smoothstep(nearDistance, farDistance, cameraDistance);
      float cameraOpacity = mix(1.0, minCameraOpacity, cameraFade);
      vAlpha = alpha * cameraOpacity;
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying float vAlpha;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      if (length(center) > 0.5) {
        discard;
      }

      gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha);
    }
  `,
};
