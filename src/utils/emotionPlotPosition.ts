import type { EmotionPlotParams } from './legacyEmotionBridge';
import {
  EMOTION_SPHERE_RADIUS,
  PURE_AREA_RATIO,
  getEmotionCenter,
} from './emotionSpaceLayout';

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function orbitBasis(intensity: number, wordId: string): { u: [number, number, number]; v: [number, number, number] } {
  const seed = hashId(`${wordId}:${Math.round(intensity)}`);
  const theta = (seed % 360) * (Math.PI / 180);
  const phi = ((seed >> 4) % 360) * (Math.PI / 180);

  const ux = Math.cos(theta);
  const uy = Math.sin(theta) * Math.cos(phi);
  const uz = Math.sin(theta) * Math.sin(phi);

  const vx = -Math.sin(theta);
  const vy = Math.cos(theta) * Math.cos(phi);
  const vz = Math.cos(theta) * Math.sin(phi);

  return { u: [ux, uy, uz], v: [vx, vy, vz] };
}

function pureOrbitRadius(intensity: number): number {
  const t = 1 - intensity / 100;
  return t * PURE_AREA_RATIO * EMOTION_SPHERE_RADIUS;
}

export function getEmotionPlotPosition(
  params: EmotionPlotParams,
  wordId: string,
  time = 0,
): [number, number, number] {
  const center = getEmotionCenter(params.primaryId);

  if (params.isPure) {
    const radius = pureOrbitRadius(params.intensity);
    const { u, v } = orbitBasis(params.intensity, wordId);
    const phase = hashId(wordId) * 0.001;
    const angle = time * 0.35 + phase;

    return [
      center.x + radius * (Math.cos(angle) * u[0] + Math.sin(angle) * v[0]),
      center.y + radius * (Math.cos(angle) * u[1] + Math.sin(angle) * v[1]),
      center.z + radius * (Math.cos(angle) * u[2] + Math.sin(angle) * v[2]),
    ];
  }

  const secondaryCenter = getEmotionCenter(params.secondaryId);
  const dx = secondaryCenter.x - center.x;
  const dy = secondaryCenter.y - center.y;
  const dz = secondaryCenter.z - center.z;
  const len = Math.hypot(dx, dy, dz) || 1;

  const minDist = PURE_AREA_RATIO * EMOTION_SPHERE_RADIUS;
  const maxDist = EMOTION_SPHERE_RADIUS * 0.88;
  const dist = minDist + (params.intensity / 100) * (maxDist - minDist);

  return [
    center.x + (dx / len) * dist,
    center.y + (dy / len) * dist,
    center.z + (dz / len) * dist,
  ];
}
