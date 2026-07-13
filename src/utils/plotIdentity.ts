import { ALL_EMOTIONS } from '../data/emotions';
import type { UserPlotRow } from '../types/userPlot';
import { normalizeUserPlotRow } from './emotionPlotBridge';
import { EXPLORATION_DUMMY_PREFIX } from './explorationDummyPlots';

/** 選択・描画キー（emotion_words は sourceId で一意化） */
export function getPlotKey(plot: Pick<UserPlotRow, 'word_id' | 'sourceId'>): string {
  if (plot.sourceId != null) {
    return `ew:${plot.sourceId}`;
  }
  return plot.word_id;
}

export function findPlotByKey(
  plots: readonly UserPlotRow[],
  key: string | null | undefined,
): UserPlotRow | null {
  if (!key) {
    return null;
  }
  if (key.startsWith('ew:')) {
    const sourceId = Number(key.slice(3));
    if (Number.isFinite(sourceId)) {
      return plots.find((plot) => plot.sourceId === sourceId) ?? null;
    }
  }
  return plots.find((plot) => plot.word_id === key || getPlotKey(plot) === key) ?? null;
}

/**
 * ワープ着地用: 単語が1つも無い感情星系へ、純感情の循環プロットを1つ補完する。
 */
export function ensureEmotionSystemLandings(plots: UserPlotRow[]): UserPlotRow[] {
  const present = new Set(plots.map((plot) => plot.primaryId));
  const extras: UserPlotRow[] = [];

  for (const emotion of ALL_EMOTIONS) {
    if (present.has(emotion.id)) {
      continue;
    }
    extras.push(
      normalizeUserPlotRow({
        word_id: `${EXPLORATION_DUMMY_PREFIX}landing-${emotion.label}`,
        primaryId: emotion.id,
        secondaryId: emotion.id,
        intensity: 42,
      }),
    );
  }

  return extras.length === 0 ? plots : [...plots, ...extras];
}

export function isWarpLandingPlot(plot: Pick<UserPlotRow, 'word_id'>): boolean {
  return plot.word_id.startsWith(`${EXPLORATION_DUMMY_PREFIX}landing-`);
}
