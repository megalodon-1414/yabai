import type { EmotionId } from '../data/emotions';
import type { UserPlotRow } from '../types/userPlot';
import { rowToEmotionParams } from './emotionPlotBridge';
import { getEmotionCenter } from './emotionSpaceLayout';
import { getPlotKey } from './plotIdentity';
import { isPureEmotionPlot, plotPositionFromRow } from './plotFromUserPlot';

function sortByIntensityDesc(a: UserPlotRow, b: UserPlotRow): number {
  const intensityDiff =
    rowToEmotionParams(b).intensity - rowToEmotionParams(a).intensity;
  if (intensityDiff !== 0) {
    return intensityDiff;
  }
  return getPlotKey(a).localeCompare(getPlotKey(b));
}

/** 行き先星系中心に最も近い語（純感情循環が空のときの代替着地） */
function findNearestToSystemCenter(
  plots: readonly UserPlotRow[],
  systemId: EmotionId,
): UserPlotRow | null {
  if (plots.length === 0) {
    return null;
  }

  const center = getEmotionCenter(systemId);
  let best: UserPlotRow | null = null;
  let bestDistance = Infinity;

  for (const plot of plots) {
    const [x, y, z] = plotPositionFromRow(plot, 0);
    const distance = Math.hypot(x - center.x, y - center.y, z - center.z);
    if (
      distance < bestDistance
      || (distance === bestDistance && best != null && getPlotKey(plot) < getPlotKey(best))
    ) {
      bestDistance = distance;
      best = plot;
    }
  }

  return best;
}

/**
 * from → to のワープ着地先。
 * 1. 行き先星系内で「元の主感情」方向（主=to・副=from）の強度最大語（極限）
 * 2. なければ行き先星系の純感情（循環上）の強度最大語
 * 3. それも無ければ行き先星系中心に最も近い語（循環上の代替）
 */
export function findLinkedWarpDestination(
  plots: readonly UserPlotRow[],
  fromEmotionId: EmotionId,
  toEmotionId: EmotionId,
  options?: {
    excludeWordId?: string | null;
  },
): UserPlotRow | null {
  const excludeWordId = options?.excludeWordId ?? null;
  const inDestination = plots.filter((plot) => {
    if (plot.primaryId !== toEmotionId) {
      return false;
    }
    if (!excludeWordId) {
      return true;
    }
    return getPlotKey(plot) !== excludeWordId && plot.word_id !== excludeWordId;
  });

  const reciprocal = inDestination
    .filter((plot) => {
      const params = rowToEmotionParams(plot);
      return !params.isPure && params.secondaryId === fromEmotionId;
    })
    .sort(sortByIntensityDesc);

  if (reciprocal[0]) {
    return reciprocal[0];
  }

  const pureOrbit = inDestination
    .filter((plot) => isPureEmotionPlot(plot))
    .sort(sortByIntensityDesc);

  if (pureOrbit[0]) {
    return pureOrbit[0];
  }

  return findNearestToSystemCenter(inDestination, toEmotionId);
}
