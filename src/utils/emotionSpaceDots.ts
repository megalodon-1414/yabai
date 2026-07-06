import * as THREE from 'three';
import type { EmotionVector } from '../types/userPlot';
import { ALL_ANCHORS } from '../emotionSpace/anchors';
import { PRIMARY_EMOTIONS } from '../emotionSpace/emotions';
import { createDefaultEmotionVector } from '../emotionSpace/migrate';
import { emotionPositionFromVector } from '../emotionSpace/plotPosition';

const PRIMARY_JITTER = 0.32;
const DYAD_JITTER = 0.2;
const PRIMARY_SAMPLES = 30;
const DYAD_SAMPLES = 5;
const RANDOM_SAMPLES = 220;

function biasedEmotionVector(): EmotionVector {
  const vector = createDefaultEmotionVector();
  const mode = Math.random();

  if (mode < 0.45) {
    const dominant = PRIMARY_EMOTIONS[Math.floor(Math.random() * PRIMARY_EMOTIONS.length)];
    for (const emotion of PRIMARY_EMOTIONS) {
      vector[emotion] = emotion === dominant
        ? 55 + Math.random() * 45
        : Math.random() * 35;
    }
    return vector;
  }

  const i = Math.floor(Math.random() * PRIMARY_EMOTIONS.length);
  const a = PRIMARY_EMOTIONS[i];
  const dist = 1 + Math.floor(Math.random() * 3);
  const b = PRIMARY_EMOTIONS[(i + dist) % PRIMARY_EMOTIONS.length];
  for (const emotion of PRIMARY_EMOTIONS) {
    if (emotion === a || emotion === b) {
      vector[emotion] = 42 + Math.random() * 48;
    } else {
      vector[emotion] = Math.random() * 22;
    }
  }
  return vector;
}

function jitterPosition(
  position: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    position[0] + (Math.random() - 0.5) * amount,
    position[1] + (Math.random() - 0.5) * amount,
    position[2] + (Math.random() - 0.5) * amount,
  ];
}

export function buildEmotionSpaceDotsGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const alphas: number[] = [];

  for (const anchor of ALL_ANCHORS) {
    const isPrimary = anchor.kind === 'primary';
    const count = isPrimary ? PRIMARY_SAMPLES : DYAD_SAMPLES;
    const jitter = isPrimary ? PRIMARY_JITTER : DYAD_JITTER;

    for (let i = 0; i < count; i += 1) {
      const [x, y, z] = jitterPosition(anchor.position, jitter);
      positions.push(x, y, z);
      alphas.push(isPrimary ? 0.38 : 0.14);
    }
  }

  for (let i = 0; i < RANDOM_SAMPLES; i += 1) {
    const [x, y, z] = emotionPositionFromVector(biasedEmotionVector());
    positions.push(x, y, z);
    alphas.push(0.1);
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
      vAlpha = alpha;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float dist = length(mvPosition.xyz);
      float cameraFade = smoothstep(farDistance, nearDistance, dist);
      vAlpha *= mix(minCameraOpacity, 1.0, cameraFade);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying float vAlpha;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;
      float edge = smoothstep(0.5, 0.2, dist);
      gl_FragColor = vec4(0.55, 0.75, 0.95, vAlpha * edge);
    }
  `,
};
