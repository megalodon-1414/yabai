import type { BasicEmotionId, EmotionId } from '../data/emotions';
import { getBasicEmotion, getEmotionById, isBasicEmotionId } from '../data/emotions';
import type { EmotionWord } from '../types/word';
import type { UserPlotRow } from '../types/userPlot';
import { findNearestBasicEmotionByAngle, findNearestEmotionByAngle } from './emotionSpaceLayout';

export interface EmotionPlotParams {
  primaryId: EmotionId;
  secondaryId: BasicEmotionId;
  intensity: number;
  isPure: boolean;
}

export function legacyRowToEmotionParams(row: UserPlotRow): EmotionPlotParams {
  const primaryId = findNearestEmotionByAngle(row.hue);
  const secondaryId = findNearestBasicEmotionByAngle(row.hue);
  const intensity = Math.max(0, Math.min(100, row.saturation));
  const isPure = isBasicEmotionId(primaryId) && primaryId === secondaryId;

  return { primaryId, secondaryId, intensity, isPure };
}

export function emotionWordToUserPlot(word: EmotionWord): UserPlotRow {
  return {
    word_id: word.id,
    mode: 'emotion',
    hue: word.angle,
    saturation: word.intensity,
    brightness: 52.5,
  };
}

export function emotionPlotColor(params: EmotionPlotParams): string {
  if (isBasicEmotionId(params.primaryId)) {
    return getBasicEmotion(params.primaryId).color;
  }
  const dyad = getEmotionById(params.primaryId);
  if ('components' in dyad) {
    const [a] = dyad.components;
    return getBasicEmotion(a).color;
  }
  return '#ffffff';
}
