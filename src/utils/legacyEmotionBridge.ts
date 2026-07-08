import type { BasicEmotionId, EmotionId } from '../data/emotions';
import { getBasicEmotion, getEmotionById, isBasicEmotionId } from '../data/emotions';
import type { EmotionWord } from '../types/word';
import type { UserPlotRow } from '../types/userPlot';
import { findNearestBasicEmotionByAngle, findNearestEmotionByAngle } from './emotionSpaceLayout';
import { blendHex, pureColorByIntensity } from './emotionColor';

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

export function getPrimaryEmotionColor(id: EmotionId): string {
  if (isBasicEmotionId(id)) {
    return getBasicEmotion(id).color;
  }
  const dyad = getEmotionById(id);
  if ('components' in dyad) {
    const [a, b] = dyad.components;
    return blendHex(getBasicEmotion(a).color, getBasicEmotion(b).color, 0.5);
  }
  return '#ffffff';
}

export function emotionPlotColor(params: EmotionPlotParams): string {
  const primary = getPrimaryEmotionColor(params.primaryId);

  if (params.isPure) {
    return pureColorByIntensity(primary, params.intensity);
  }

  const secondary = getBasicEmotion(params.secondaryId).color;
  return blendHex(primary, secondary, params.intensity / 100);
}
