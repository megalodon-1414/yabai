import type { PrimaryEmotion } from './emotions';
import { emotionIndex, PRIMARY_EMOTIONS } from './emotions';

export const GALAXY_RADIUS = 3;
export const GALAXY_HEIGHT = 2;

/** dyad アンカーを原点から外側へ押し出す倍率（距離が遠いほど中央に寄りやすいため強め） */
export const DYAD_RADIAL_SCALE: Record<1 | 2 | 3, number> = {
  1: 1.1,
  2: 1.35,
  3: 1.6,
};

export const MIN_PLOT_RADIUS = 1.15;

export type Vec3 = [number, number, number];

/** 上面: 喜び・恐れ・悲しみ・怒り / 底面: 信頼・驚き・嫌悪・期待（45°ねじれ） */
export function primaryEmotionPosition(emotion: PrimaryEmotion): Vec3 {
  const index = emotionIndex(emotion);
  const isTop = index % 2 === 0;
  const y = isTop ? GALAXY_HEIGHT : -GALAXY_HEIGHT;

  const thetaDeg = isTop ? (index / 2) * 90 : ((index - 1) / 2) * 90 + 45;
  const theta = (thetaDeg * Math.PI) / 180;

  return [
    GALAXY_RADIUS * Math.sin(theta),
    y,
    -GALAXY_RADIUS * Math.cos(theta),
  ];
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

export function getAllPrimaryPositions(): Record<PrimaryEmotion, Vec3> {
  const positions = {} as Record<PrimaryEmotion, Vec3>;
  for (const emotion of PRIMARY_EMOTIONS) {
    positions[emotion] = primaryEmotionPosition(emotion);
  }
  return positions;
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  if (len < 1e-8) return [0, 0, 0];
  return scale(a, 1 / len);
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function expandFromOrigin(position: Vec3, factor: number): Vec3 {
  return scale(position, factor);
}

export function enforceMinimumRadius(position: Vec3, fallback: Vec3, minRadius = MIN_PLOT_RADIUS): Vec3 {
  const r = length(position);
  if (r >= minRadius) return position;

  const guide = r > 1e-6 ? position : fallback;
  const guideLen = length(guide);
  if (guideLen < 1e-6) return scale(normalize(fallback), minRadius);

  return scale(normalize(guide), minRadius);
}
