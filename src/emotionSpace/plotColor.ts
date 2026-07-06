import type { EmotionVector } from '../types/userPlot';
import { EMOTION_HUES, PRIMARY_EMOTIONS, type PrimaryEmotion } from './emotions';
import { getEmotionDominance } from './plotPosition';

function blendHue(weights: Record<PrimaryEmotion, number>): number {
  let sinSum = 0;
  let cosSum = 0;

  for (const emotion of PRIMARY_EMOTIONS) {
    const rad = (EMOTION_HUES[emotion] * Math.PI) / 180;
    sinSum += Math.sin(rad) * weights[emotion];
    cosSum += Math.cos(rad) * weights[emotion];
  }

  const hue = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
  return hue < 0 ? hue + 360 : hue;
}

function normalizedWeights(vector: EmotionVector): Record<PrimaryEmotion, number> {
  const weights = {} as Record<PrimaryEmotion, number>;
  let sum = 0;
  for (const emotion of PRIMARY_EMOTIONS) {
    weights[emotion] = Math.max(0, vector[emotion] ?? 0);
    sum += weights[emotion];
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

export function emotionColorFromVector(vector: EmotionVector): string {
  const weights = normalizedWeights(vector);
  const dominance = getEmotionDominance(vector);
  const hue = blendHue(weights);
  const saturation = 45 + dominance * 45;
  const lightness = 38 + (1 - dominance) * 18;

  return `hsl(${hue.toFixed(1)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(1)}%)`;
}

export function getPlotIntensity(vector: EmotionVector): number {
  const sum = PRIMARY_EMOTIONS.reduce((total, emotion) => total + Math.max(0, vector[emotion] ?? 0), 0);
  return Math.min(1, sum / (PRIMARY_EMOTIONS.length * 50));
}

export function getPlotSpread(vector: EmotionVector): number {
  return 1 - getEmotionDominance(vector);
}

export { getDominantEmotion, getEmotionDominance } from './plotPosition';
