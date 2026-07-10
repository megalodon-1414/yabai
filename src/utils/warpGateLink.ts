import type { EmotionId } from '../data/emotions';
import type { UserPlotRow } from '../types/userPlot';
import { rowToEmotionParams } from './emotionPlotBridge';
import {
  getEmotionCenter,
  getEmotionSphereRadius,
} from './emotionSpaceLayout';
import {
  plotPositionFromRow,
  type PlotOrbitOverrideMap,
} from './plotFromUserPlot';

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

/**
 * from → to のワープ着地先。
 * 優先: to 星系内の「from への戻りゲート」語（主=to・副=from）
 * 次点: to 星系内で from 向きの端に最も近い語
 */
export function findLinkedWarpDestination(
  plots: readonly UserPlotRow[],
  fromEmotionId: EmotionId,
  toEmotionId: EmotionId,
  options?: {
    excludeWordId?: string | null;
    orbitOverrides?: PlotOrbitOverrideMap;
  },
): UserPlotRow | null {
  const excludeWordId = options?.excludeWordId ?? null;
  const orbitOverrides = options?.orbitOverrides;

  const reciprocal = plots
    .filter((plot) => {
      if (excludeWordId && plot.word_id === excludeWordId) {
        return false;
      }
      const params = rowToEmotionParams(plot);
      return (
        !params.isPure
        && params.primaryId === toEmotionId
        && params.secondaryId === fromEmotionId
      );
    })
    .sort((a, b) => b.intensity - a.intensity || a.word_id.localeCompare(b.word_id));

  if (reciprocal[0]) {
    return reciprocal[0];
  }

  const landing = getFacingEdgePosition(toEmotionId, fromEmotionId);
  const candidates = plots.filter(
    (plot) => plot.primaryId === toEmotionId && plot.word_id !== excludeWordId,
  );
  if (candidates.length === 0) {
    return null;
  }

  let best = candidates[0];
  let bestDistance = Infinity;
  for (const plot of candidates) {
    const position = plotPositionFromRow(plot, 0, orbitOverrides?.get(plot.word_id));
    const distance = Math.hypot(
      position[0] - landing[0],
      position[1] - landing[1],
      position[2] - landing[2],
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = plot;
    }
  }

  return best;
}
