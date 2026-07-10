import type { BasicEmotionId, EmotionId } from '../data/emotions';
import {
  BASIC_EMOTIONS,
  DYAD_EMOTIONS,
  isBasicEmotionId,
} from '../data/emotions';

export type EmotionWordTypeId = 'adjective' | 'idiom';

export interface SupabaseWordTypeRow {
  id: number;
  name: string;
}

export interface SupabaseEmotionRow {
  id: number;
  name: string;
  tier: string;
  combo: string | null;
}

export interface SupabaseEmotionWordRow {
  id: number;
  word: string;
  ruby: string | null;
  meaning: string | null;
  usage_example: string | null;
  primary_emotion_id: number;
  secondary_emotion_id: number | null;
  secondary_value: number | null;
  word_type_id: number | null;
  source?: string | null;
  created_at?: string;
}

const BASIC_LABEL_TO_ID: Record<string, BasicEmotionId> = Object.fromEntries(
  BASIC_EMOTIONS.map((emotion) => [emotion.label, emotion.id]),
) as Record<string, BasicEmotionId>;

const WORD_TYPE_BY_NAME: Record<string, EmotionWordTypeId> = {
  イ形容詞: 'adjective',
  形容詞: 'adjective',
  熟語: 'idiom',
};

function parseComboBasics(combo: string | null): [BasicEmotionId, BasicEmotionId] | null {
  if (!combo) {
    return null;
  }

  const parts = combo
    .split(/[＋+]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  const a = BASIC_LABEL_TO_ID[parts[0]];
  const b = BASIC_LABEL_TO_ID[parts[1]];
  if (!a || !b) {
    return null;
  }

  return [a, b];
}

function findDyadId(components: [BasicEmotionId, BasicEmotionId]): EmotionId | null {
  const match = DYAD_EMOTIONS.find(
    (dyad) =>
      (dyad.components[0] === components[0] && dyad.components[1] === components[1]) ||
      (dyad.components[0] === components[1] && dyad.components[1] === components[0]),
  );
  return match?.id ?? null;
}

/** Supabase emotions.id → アプリ内 EmotionId */
export function mapSupabaseEmotionToAppId(emotion: SupabaseEmotionRow): EmotionId | null {
  if (emotion.tier === 'basic8') {
    return BASIC_LABEL_TO_ID[emotion.name] ?? null;
  }

  const components = parseComboBasics(emotion.combo);
  if (!components) {
    return null;
  }

  return findDyadId(components);
}

export function buildEmotionIdBySupabaseId(
  emotions: readonly SupabaseEmotionRow[],
): Map<number, EmotionId> {
  const map = new Map<number, EmotionId>();
  for (const emotion of emotions) {
    const appId = mapSupabaseEmotionToAppId(emotion);
    if (appId) {
      map.set(emotion.id, appId);
    }
  }
  return map;
}

export function mapWordTypeId(
  wordTypeId: number | null | undefined,
  wordTypes: readonly SupabaseWordTypeRow[],
): EmotionWordTypeId | undefined {
  if (wordTypeId == null) {
    return undefined;
  }
  const row = wordTypes.find((type) => type.id === wordTypeId);
  if (!row) {
    return undefined;
  }
  return WORD_TYPE_BY_NAME[row.name];
}

export function wordTypeLabel(wordType: EmotionWordTypeId | undefined): string | null {
  if (wordType === 'adjective') return '形容詞';
  if (wordType === 'idiom') return '熟語';
  return null;
}

export function resolveSecondaryBasicId(
  secondaryEmotionId: number | null | undefined,
  emotionIdBySupabaseId: Map<number, EmotionId>,
  primaryId: EmotionId,
): BasicEmotionId {
  if (secondaryEmotionId != null) {
    const mapped = emotionIdBySupabaseId.get(secondaryEmotionId);
    if (mapped && isBasicEmotionId(mapped)) {
      return mapped;
    }
  }

  if (isBasicEmotionId(primaryId)) {
    return primaryId;
  }

  const dyad = DYAD_EMOTIONS.find((item) => item.id === primaryId);
  return dyad?.components[0] ?? 'joy';
}
