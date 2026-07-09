import type { UserPlotRow } from '../types/userPlot';

/** 探索モードで現在単語から見える近傍半径 */
export const EXPLORATION_NEARBY_RADIUS = 3.2;

/** 探索モードの静止点カメラ距離（通常選択より近い） */
export const EXPLORATION_CAMERA_DISTANCE = 0.4;

/** 探索モードで選択中プロットを置く画面位置（原点は左下） */
export const EXPLORATION_SCREEN_ANCHOR = { x: 0.24, y: 0.5 };

export function pickRandomPlotId(plots: UserPlotRow[]): string | null {
  if (plots.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * plots.length);
  return plots[index]?.word_id ?? null;
}
