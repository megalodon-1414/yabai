import { supabase } from '../lib/supabase';
import type { UserPlotRow } from '../types/userPlot';
import { clampEmotionVector, parseUserPlotRow } from '../emotionSpace/migrate';

function normalizeRow(row: UserPlotRow) {
  return {
    word_id: row.word_id,
    emotions: clampEmotionVector(row.emotions),
  };
}

export async function fetchUserPlots(): Promise<UserPlotRow[]> {
  const { data, error } = await supabase.from('user_plots').select('*').order('word_id');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => parseUserPlotRow(row))
    .filter((row): row is UserPlotRow => row !== null);
}

export async function syncUserPlots(plots: UserPlotRow[]): Promise<void> {
  const existing = await fetchUserPlots();
  const localIds = new Set(plots.map((plot) => plot.word_id));

  if (plots.length > 0) {
    const { error } = await supabase
      .from('user_plots')
      .upsert(plots.map(normalizeRow), { onConflict: 'word_id' });

    if (error) {
      throw new Error(error.message);
    }
  }

  const idsToDelete = existing
    .map((plot) => plot.word_id)
    .filter((wordId) => !localIds.has(wordId));

  if (idsToDelete.length > 0) {
    const { error } = await supabase.from('user_plots').delete().in('word_id', idsToDelete);

    if (error) {
      throw new Error(error.message);
    }
  }
}
