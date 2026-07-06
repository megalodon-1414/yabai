import type { PrimaryEmotion } from '../emotionSpace/emotions';

export type EmotionVector = Record<PrimaryEmotion, number>;

export interface UserPlotRow {
  word_id: string;
  emotions: EmotionVector;
}

/** Supabase 旧形式からの移行用 */
export interface LegacyUserPlotRow {
  word_id: string;
  mode?: string;
  hue?: number;
  brightness?: number;
  saturation?: number;
}
