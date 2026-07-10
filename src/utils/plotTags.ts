import type { UserPlotRow } from '../types/userPlot';
import { isExplorationDummyPlot } from './explorationDummyPlots';
import { wordTypeLabel } from './emotionWordsBridge';

export type PlotTagId =
  | 'registered'
  | 'exploration-dummy'
  | 'adjective'
  | 'idiom'
  | 'verb';

export interface PlotTagDefinition {
  id: PlotTagId;
  label: string;
  /** データ上まだ付与できない想定タグ */
  available: boolean;
}

export const PLOT_TAGS: PlotTagDefinition[] = [
  { id: 'registered', label: '登録単語', available: true },
  { id: 'exploration-dummy', label: '探索用ダミー', available: true },
  { id: 'adjective', label: '形容詞', available: true },
  { id: 'idiom', label: '熟語', available: true },
  { id: 'verb', label: '動詞', available: false },
];

export function getPlotTagIds(plot: UserPlotRow): PlotTagId[] {
  if (isExplorationDummyPlot(plot.word_id)) {
    return ['exploration-dummy'];
  }

  const tags: PlotTagId[] = ['registered'];
  if (plot.wordType === 'adjective') {
    tags.push('adjective');
  }
  if (plot.wordType === 'idiom') {
    tags.push('idiom');
  }
  return tags;
}

export function getPlotKindLabel(plot: UserPlotRow): string {
  if (isExplorationDummyPlot(plot.word_id)) {
    return '探索用ダミー';
  }
  return wordTypeLabel(plot.wordType) ?? '登録単語';
}

/** 選択タグが空なら全件。いずれかの選択タグに一致するプロットのみ残す。 */
export function filterPlotsByTags(
  plots: UserPlotRow[],
  selectedTagIds: ReadonlySet<PlotTagId>,
): UserPlotRow[] {
  if (selectedTagIds.size === 0) {
    return plots;
  }

  return plots.filter((plot) => {
    const tags = getPlotTagIds(plot);
    return tags.some((tag) => selectedTagIds.has(tag));
  });
}

export function searchPlotsByQuery(
  plots: UserPlotRow[],
  query: string,
  limit = 8,
): UserPlotRow[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return plots
    .filter((plot) => {
      const haystacks = [plot.word_id, plot.ruby ?? '', plot.meaning ?? ''];
      return haystacks.some((text) => text.toLowerCase().includes(normalized));
    })
    .slice(0, limit);
}
