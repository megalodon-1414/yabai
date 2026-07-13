import type { EmotionId } from '../data/emotions';
import type { UserPlotRow } from '../types/userPlot';
import { rowToEmotionParams } from './emotionPlotBridge';
import {
  getEmotionCenter,
  getEmotionSphereRadius,
} from './emotionSpaceLayout';
import { isPureEmotionPlot } from './plotFromUserPlot';

/** 星系 `systemId` の球面上で、`towardId` 星系を向いた端の位置 */
export function getFacingEdgePosition(
  systemId: EmotionId,
  towardId: EmotionId,
): [number, number, number] {
  const center = getEmotionCenter(systemId);
  const toward = getEmotionCenter(towardId);
  const radius = getEmotionSphereRadius(systemId);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const dz = toward.z - center.z;
  const length = Math.hypot(dx, dy, dz) || 1;

  return [
    center.x + (dx / length) * radius,
    center.y + (dy / length) * radius,
    center.z + (dz / length) * radius,
  ];
}

function sortByIntensityDesc(a: UserPlotRow, b: UserPlotRow): number {
  const intensityDiff =
    rowToEmotionParams(b).intensity - rowToEmotionParams(a).intensity;
  if (intensityDiff !== 0) {
    return intensityDiff;
  }
  return a.word_id.localeCompare(b.word_id);
}

/**
 * from → to のワープ着地先。
 * 1. 行き先星系内で「元の主感情」方向（主=to・副=from）の強度最大語（極限）
 * 2. なければ行き先星系の純感情（循環上）の強度最大語
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
  const inDestination = plots.filter(
    (plot) => plot.primaryId === toEmotionId && plot.word_id !== excludeWordId,
  );

  const reciprocal = inDestination
    .filter((plot) => {
      const params = rowToEmotionParams(plot);
      return !params.isPure && params.secondaryId === fromEmotionId;
    })
    .sort(sortByIntensityDesc);

  if (reciprocal[0]) {
    return reciprocal[0];
  }

  // その方向の語が無い → 行き先空間の純感情循環上へ
  const pureOrbit = inDestination
    .filter((plot) => isPureEmotionPlot(plot))
    .sort(sortByIntensityDesc);

  return pureOrbit[0] ?? null;
}
