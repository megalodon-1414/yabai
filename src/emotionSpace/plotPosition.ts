import type { EmotionVector } from '../types/userPlot';
import { ALL_ANCHORS, DYAD_ANCHORS, type EmotionAnchor } from './anchors';
import { PRIMARY_EMOTIONS, type PrimaryEmotion, wheelNeighbors } from './emotions';
import {
  add,
  enforceMinimumRadius,
  getAllPrimaryPositions,
  lerpVec,
  normalize,
  primaryEmotionPosition,
  scale,
  subtract,
  type Vec3,
} from './geometry';

export const MACRO_SHARPNESS = 3.2;
export const WELL_SCATTER_MAX = 0.48;
export const WELL_LOCK_POWER = 0.72;
export const DYAD_SCATTER_MAX = 0.36;
export const DYAD_LOCK_POWER = 0.8;
/** 単一感情がこれ以上突出すると dyad 吸着を抑制 */
export const SINGLE_CLEAR_MARGIN = 1.32;
export const DYAD_DOMINANCE_THRESHOLD = 0.34;
export const LOW_DOMINANCE_THRESHOLD = 0.26;
/** ペア2感情の弱い方が、それ以外の最大値よりこれだけ高い必要がある (0–100) */
export const PAIR_EXCESS_MIN = 4;

export interface DyadAffinity {
  anchor: EmotionAnchor;
  strength: number;
}

function emotionWeights(vector: EmotionVector): Record<PrimaryEmotion, number> {
  const weights = {} as Record<PrimaryEmotion, number>;
  let sum = 0;
  for (const emotion of PRIMARY_EMOTIONS) {
    const value = Math.max(0, vector[emotion] ?? 0);
    weights[emotion] = value;
    sum += value;
  }
  if (sum < 1e-6) {
    for (const emotion of PRIMARY_EMOTIONS) {
      weights[emotion] = 1 / PRIMARY_EMOTIONS.length;
    }
    return weights;
  }
  for (const emotion of PRIMARY_EMOTIONS) {
    weights[emotion] /= sum;
  }
  return weights;
}

function rawWeights(vector: EmotionVector): Record<PrimaryEmotion, number> {
  const weights = {} as Record<PrimaryEmotion, number>;
  for (const emotion of PRIMARY_EMOTIONS) {
    weights[emotion] = Math.max(0, vector[emotion] ?? 0);
  }
  return weights;
}

function sharpen(value: number, gamma: number): number {
  return Math.pow(Math.max(0, value), gamma);
}

function dominantEmotion(weights: Record<PrimaryEmotion, number>): PrimaryEmotion {
  return PRIMARY_EMOTIONS.reduce((best, emotion) =>
    weights[emotion] > weights[best] ? emotion : best,
  );
}

function dyadScore(raw: Record<PrimaryEmotion, number>, a: PrimaryEmotion, b: PrimaryEmotion): number {
  return Math.sqrt(raw[a] * raw[b]);
}

function maxRawExcluding(
  raw: Record<PrimaryEmotion, number>,
  exclude: PrimaryEmotion[],
): number {
  const skip = new Set(exclude);
  let max = 0;
  for (const emotion of PRIMARY_EMOTIONS) {
    if (skip.has(emotion)) continue;
    max = Math.max(max, raw[emotion]);
  }
  return max;
}

function sortedRawDesc(raw: Record<PrimaryEmotion, number>): number[] {
  return PRIMARY_EMOTIONS.map((emotion) => raw[emotion]).sort((a, b) => b - a);
}

/** 2感情が共立して突出しているとき、最も適合する dyad と吸着強度を返す */
export function findDyadAffinity(
  raw: Record<PrimaryEmotion, number>,
  normalized: Record<PrimaryEmotion, number>,
): DyadAffinity | null {
  const totalRaw = PRIMARY_EMOTIONS.reduce((sum, emotion) => sum + raw[emotion], 0);
  if (totalRaw < 1e-6) return null;

  const maxRaw = Math.max(...PRIMARY_EMOTIONS.map((emotion) => raw[emotion]));
  const singleDominance = Math.max(...PRIMARY_EMOTIONS.map((emotion) => normalized[emotion]));
  const [topRaw, secondRaw] = sortedRawDesc(raw);

  let best: { anchor: EmotionAnchor; score: number } | null = null;
  let secondBestScore = 0;

  for (const anchor of DYAD_ANCHORS) {
    const [a, b] = anchor.emotions;
    const minPair = Math.min(raw[a], raw[b]);
    const maxOther = maxRawExcluding(raw, [a, b]);
    const pairExcess = minPair - maxOther;
    if (pairExcess < PAIR_EXCESS_MIN) continue;

    const harmonic = dyadScore(raw, a, b);
    const balance = minPair / (Math.max(raw[a], raw[b]) + 1e-6);
    const distanceWeight = anchor.dyadDistance === 1 ? 1 : anchor.dyadDistance === 2 ? 0.92 : 0.85;
    const score = harmonic * (0.65 + balance * 0.35) * distanceWeight * (1 + pairExcess / (maxRaw + 1e-6));

    if (!best || score > best.score) {
      if (best) secondBestScore = Math.max(secondBestScore, best.score);
      best = { anchor, score };
    } else {
      secondBestScore = Math.max(secondBestScore, score);
    }
  }

  if (!best) return null;

  const [a, b] = best.anchor.emotions;
  const pairShare = (raw[a] + raw[b]) / totalRaw;
  const pairRatio = best.score / (secondBestScore + 1e-6);

  if (topRaw > secondRaw * SINGLE_CLEAR_MARGIN && singleDominance > 0.34) {
    return null;
  }

  if (pairShare < 0.38 && pairRatio < 1.18) {
    return null;
  }

  let strength =
    Math.pow(pairShare, 0.7) *
    Math.min(1, 0.25 + (pairRatio - 1) * 0.55) *
    (1 - Math.pow(singleDominance, 1.6) * 0.75);

  const bothElevated = raw[a] >= maxRaw * 0.45 && raw[b] >= maxRaw * 0.45;
  if (!bothElevated) {
    strength *= 0.55;
  }

  strength = Math.min(1, Math.max(0, strength));
  if (strength < 0.18) return null;

  return { anchor: best.anchor, strength };
}

function macroPosition(
  raw: Record<PrimaryEmotion, number>,
  dyadAffinity: DyadAffinity | null,
): Vec3 {
  const totalRaw = PRIMARY_EMOTIONS.reduce((sum, emotion) => sum + raw[emotion], 0);
  const dominance = totalRaw > 0 ? Math.max(...PRIMARY_EMOTIONS.map((e) => raw[e])) / totalRaw : 0;
  const useDyads = dominance >= DYAD_DOMINANCE_THRESHOLD || dyadAffinity !== null;
  let total = 0;
  const accum: Vec3 = [0, 0, 0];

  for (const anchor of ALL_ANCHORS) {
    if (anchor.kind === 'dyad' && !useDyads) continue;

    let score = 0;
    if (anchor.kind === 'primary') {
      score = sharpen(raw[anchor.emotions[0]], MACRO_SHARPNESS);
    } else {
      const [ea, eb] = anchor.emotions;
      score = sharpen(dyadScore(raw, ea, eb), MACRO_SHARPNESS);
      if (anchor.dyadDistance === 2) score *= 0.75;
      if (anchor.dyadDistance === 3) score *= 0.55;
      if (dyadAffinity && anchor.id === dyadAffinity.anchor.id) {
        score *= 1 + dyadAffinity.strength * 0.85;
      }
    }

    if (score <= 0) continue;
    total += score;
    accum[0] += anchor.position[0] * score;
    accum[1] += anchor.position[1] * score;
    accum[2] += anchor.position[2] * score;
  }

  if (total < 1e-8) {
    return [0, 0, 0];
  }

  return [accum[0] / total, accum[1] / total, accum[2] / total];
}

function wellScatterOffset(
  dominant: PrimaryEmotion,
  weights: Record<PrimaryEmotion, number>,
): Vec3 {
  const center = primaryEmotionPosition(dominant);
  const neighbors = wheelNeighbors(dominant);
  let blend: Vec3 = [0, 0, 0];

  for (const neighbor of neighbors) {
    const w = weights[neighbor];
    if (w <= 0) continue;
    blend = add(blend, scale(subtract(primaryEmotionPosition(neighbor), center), w));
  }

  return blend;
}

function dyadScatterPosition(
  affinity: DyadAffinity,
  raw: Record<PrimaryEmotion, number>,
): Vec3 {
  const [a, b] = affinity.anchor.emotions;
  const center = affinity.anchor.position;
  const pa = primaryEmotionPosition(a);
  const pb = primaryEmotionPosition(b);
  const alongT = raw[a] / (raw[a] + raw[b] + 1e-6);
  const along = lerpVec(pa, pb, alongT);
  const base = lerpVec(center, along, 0.3);

  const scatter = DYAD_SCATTER_MAX * Math.pow(1 - affinity.strength, 1.2);
  const thirdDir = subtract(
    add(pa, pb),
    scale(center, 2),
  );
  const thirdLen = Math.hypot(thirdDir[0], thirdDir[1], thirdDir[2]);
  if (thirdLen < 1e-6 || scatter < 1e-6) {
    return base;
  }

  return add(base, scale(normalize(thirdDir), scatter * 0.35));
}

export function emotionPositionFromVector(vector: EmotionVector): Vec3 {
  const weights = emotionWeights(vector);
  const raw = rawWeights(vector);
  const dominant = dominantEmotion(weights);
  const dominance = weights[dominant];
  const dyadAffinity = findDyadAffinity(raw, weights);

  const well = primaryEmotionPosition(dominant);
  const macro = macroPosition(raw, dyadAffinity);

  const scatter = WELL_SCATTER_MAX * Math.pow(1 - dominance, 1.45);
  const scatterDir = wellScatterOffset(dominant, weights);
  const scatterLen = Math.hypot(scatterDir[0], scatterDir[1], scatterDir[2]);
  const wellPosition =
    scatterLen > 1e-6
      ? add(well, scale(normalize(scatterDir), scatter))
      : well;

  const dyadPosition = dyadAffinity ? dyadScatterPosition(dyadAffinity, raw) : macro;
  const dyadLock = dyadAffinity ? Math.pow(dyadAffinity.strength, DYAD_LOCK_POWER) : 0;
  const primaryLock = Math.pow(dominance, WELL_LOCK_POWER) * (1 - dyadLock * 0.9);

  let merged = macro;
  if (dyadAffinity) {
    merged = lerpVec(merged, dyadPosition, dyadLock);
  }
  merged = lerpVec(merged, wellPosition, primaryLock);

  if (dominance < LOW_DOMINANCE_THRESHOLD && !dyadAffinity) {
    merged = enforceMinimumRadius(merged, well);
  }

  return merged;
}

export function getEmotionDominance(vector: EmotionVector): number {
  const weights = emotionWeights(vector);
  return Math.max(...PRIMARY_EMOTIONS.map((emotion) => weights[emotion]));
}

export function getDominantEmotion(vector: EmotionVector): PrimaryEmotion {
  return dominantEmotion(emotionWeights(vector));
}

export function getDominantDyad(vector: EmotionVector): DyadAffinity | null {
  const weights = emotionWeights(vector);
  const raw = rawWeights(vector);
  return findDyadAffinity(raw, weights);
}

export function getPrimaryPositions(): Record<PrimaryEmotion, Vec3> {
  return getAllPrimaryPositions();
}
