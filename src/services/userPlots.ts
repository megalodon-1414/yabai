import { supabase } from '../lib/supabase';
import type { UserPlotRow } from '../types/userPlot';

function normalizeRow(row: UserPlotRow) {
  return {
    word_id: row.word_id,
    mode: row.mode,
    hue: Math.round(row.hue * 100) / 100,
    brightness: Math.round(row.brightness * 100) / 100,
    saturation: Math.round(row.saturation * 100) / 100,
  };
}

export async function fetchUserPlots(): Promise<UserPlotRow[]> {
  const { data, error } = await supabase.from('user_plots').select('*').order('word_id');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as UserPlotRow[];
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
