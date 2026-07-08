import type { BasicEmotionId, EmotionId } from '../data/emotions';

export interface UserPlotRow {
  word_id: string;
  primaryId: EmotionId;
  secondaryId: BasicEmotionId;
  intensity: number;
}

/** Supabase 旧形式からの移行用 */
export interface LegacyUserPlotRow {
  word_id: string;
  mode?: string;
  hue?: number;
  brightness?: number;
  saturation?: number;
  emotions?: Record<string, number>;
}
