import type { EmotionVector, LegacyUserPlotRow, UserPlotRow } from '../types/userPlot';
import { PRIMARY_EMOTIONS, type PrimaryEmotion } from './emotions';

const LEGACY_HUE_BY_EMOTION: Record<PrimaryEmotion, number> = {
  joy: 0,
  trust: 45,
  fear: 90,
  surprise: 135,
  sadness: 180,
  disgust: 225,
  anger: 270,
  anticipation: 315,
};

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

export function createDefaultEmotionVector(): EmotionVector {
  return {
    joy: 50,
    trust: 20,
    fear: 20,
    surprise: 20,
    sadness: 20,
    disgust: 20,
    anger: 20,
    anticipation: 50,
  };
}

export function migrateHueToEmotions(hue: number, saturation: number, brightness: number): EmotionVector {
  const sigma = 28;
  const raw = {} as Record<PrimaryEmotion, number>;

  for (const emotion of PRIMARY_EMOTIONS) {
    const angle = LEGACY_HUE_BY_EMOTION[emotion];
    const diff = angularDistance(hue, angle);
    const angularWeight = Math.exp(-(diff * diff) / (2 * sigma * sigma));
    raw[emotion] = angularWeight * (saturation / 100) * 80 + 8;
  }

  const brightnessBoost = ((brightness - 25) / 55) * 25;
  for (const emotion of PRIMARY_EMOTIONS) {
    raw[emotion] += brightnessBoost * 0.15;
  }

  const vector = {} as EmotionVector;
  for (const emotion of PRIMARY_EMOTIONS) {
    vector[emotion] = Math.round(Math.max(0, Math.min(100, raw[emotion])));
  }
  return vector;
}

export function parseUserPlotRow(row: unknown): UserPlotRow | null {
  if (!row || typeof row !== 'object') return null;
  const data = row as Record<string, unknown>;
  const word_id = typeof data.word_id === 'string' ? data.word_id : null;
  if (!word_id) return null;

  if (data.emotions && typeof data.emotions === 'object') {
    const emotions = data.emotions as Record<string, unknown>;
    const vector = {} as EmotionVector;
    for (const emotion of PRIMARY_EMOTIONS) {
      const value = Number(emotions[emotion] ?? 0);
      vector[emotion] = Math.max(0, Math.min(100, Math.round(value)));
    }
    return { word_id, emotions: vector };
  }

  if (data.mode === 'state') {
    return null;
  }

  const legacy = data as unknown as LegacyUserPlotRow;
  if (typeof legacy.hue === 'number') {
    return {
      word_id,
      emotions: migrateHueToEmotions(
        legacy.hue,
        legacy.saturation ?? 50,
        legacy.brightness ?? 52.5,
      ),
    };
  }

  return { word_id, emotions: createDefaultEmotionVector() };
}

export function clampEmotionVector(vector: EmotionVector): EmotionVector {
  const clamped = {} as EmotionVector;
  for (const emotion of PRIMARY_EMOTIONS) {
    clamped[emotion] = Math.max(0, Math.min(100, Math.round(vector[emotion] ?? 0)));
  }
  return clamped;
}
