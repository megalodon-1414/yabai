import type { UserPlotRow } from '../types/userPlot';
import { emotionPlotColor, rowToEmotionParams } from './emotionPlotBridge';
import { getEmotionPlotPosition, type PlotOrbitOverride } from './emotionPlotPosition';
import { getEmotionCenter, getEmotionSphereRadius } from './emotionSpaceLayout';

export type { PlotOrbitOverride } from './emotionPlotPosition';

export function plotColorFromRow(row: UserPlotRow): string {
  return emotionPlotColor(rowToEmotionParams(row));
}

export function plotPositionFromRow(
  row: UserPlotRow,
  time = 0,
  orbitOverride?: PlotOrbitOverride,
): [number, number, number] {
  return getEmotionPlotPosition(rowToEmotionParams(row), row.word_id, time, orbitOverride);
}

const NEARBY_PLOT_RADIUS = 2.5;
const MIXED_ORBIT_INTENSITY_GAP = 5;
const MIXED_ORBIT_MAX_GROUP_SIZE = 3;
const MIXED_ORBIT_RADIUS_PADDING_RATIO = 0.12;
const MIXED_ORBIT_MIN_RADIUS_RATIO = 0.2;

export type PlotOrbitOverrideMap = Map<string, PlotOrbitOverride>;

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normalize(vec: [number, number, number]): [number, number, number] {
  const length = Math.hypot(vec[0], vec[1], vec[2]) || 1;
  return [vec[0] / length, vec[1] / length, vec[2] / length];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function createMixedOrbitBasis(plot: UserPlotRow): {
  u: [number, number, number];
  v: [number, number, number];
} {
  const primaryCenter = getEmotionCenter(plot.primaryId);
  const secondaryCenter = getEmotionCenter(plot.secondaryId);
  const axis = normalize([
    secondaryCenter.x - primaryCenter.x,
    secondaryCenter.y - primaryCenter.y,
    secondaryCenter.z - primaryCenter.z,
  ]);
  const reference: [number, number, number] = Math.abs(axis[1]) < 0.82 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(axis, reference));
  const v = normalize(cross(axis, u));

  return { u, v };
}

function addMixedOrbitGroup(overrides: PlotOrbitOverrideMap, group: UserPlotRow[]) {
  if (group.length < 2) {
    return;
  }

  const basePositions = group.map((plot) => plotPositionFromRow(plot));
  const center: [number, number, number] = [0, 0, 0];
  for (const position of basePositions) {
    center[0] += position[0];
    center[1] += position[1];
    center[2] += position[2];
  }
  center[0] /= group.length;
  center[1] /= group.length;
  center[2] /= group.length;

  const baseRadius = basePositions.reduce(
    (max, position) =>
      Math.max(max, Math.hypot(position[0] - center[0], position[1] - center[1], position[2] - center[2])),
    0,
  );
  const sphereRadius = getEmotionSphereRadius(group[0].primaryId);
  const radius = Math.max(
    baseRadius + sphereRadius * MIXED_ORBIT_RADIUS_PADDING_RATIO,
    sphereRadius * MIXED_ORBIT_MIN_RADIUS_RATIO,
  );
  const { u, v } = createMixedOrbitBasis(group[0]);
  const basePhase = hashId(`${group[0].primaryId}:${group[0].secondaryId}`) * 0.001;
  const groupKey = group
    .map((plot) => plot.word_id)
    .sort()
    .join('|');

  group.forEach((plot, index) => {
    overrides.set(plot.word_id, {
      groupKey,
      center,
      u,
      v,
      radius,
      phase: basePhase + (index / group.length) * Math.PI * 2,
    });
  });
}

export function createMixedPlotOrbitOverrides(plots: UserPlotRow[]): PlotOrbitOverrideMap {
  const byEmotionPair = new Map<string, UserPlotRow[]>();

  for (const plot of plots) {
    const params = rowToEmotionParams(plot);
    if (params.isPure) {
      continue;
    }

    const key = `${params.primaryId}:${params.secondaryId}`;
    const group = byEmotionPair.get(key) ?? [];
    group.push(plot);
    byEmotionPair.set(key, group);
  }

  const overrides: PlotOrbitOverrideMap = new Map();
  for (const group of byEmotionPair.values()) {
    const sorted = [...group].sort((a, b) => {
      const intensityDiff = rowToEmotionParams(a).intensity - rowToEmotionParams(b).intensity;
      return intensityDiff || a.word_id.localeCompare(b.word_id);
    });
    let cluster: UserPlotRow[] = [];
    let previousIntensity: number | null = null;

    const flush = () => {
      for (let start = 0; start < cluster.length; start += MIXED_ORBIT_MAX_GROUP_SIZE) {
        addMixedOrbitGroup(overrides, cluster.slice(start, start + MIXED_ORBIT_MAX_GROUP_SIZE));
      }
      cluster = [];
      previousIntensity = null;
    };

    for (const plot of sorted) {
      const intensity = rowToEmotionParams(plot).intensity;
      if (
        previousIntensity !== null &&
        (intensity - previousIntensity >= MIXED_ORBIT_INTENSITY_GAP ||
          cluster.length >= MIXED_ORBIT_MAX_GROUP_SIZE)
      ) {
        flush();
      }

      cluster.push(plot);
      previousIntensity = intensity;
    }

    flush();
  }

  return overrides;
}

export function getNearbyPlotIds(
  plots: UserPlotRow[],
  selectedId: string,
  radius = NEARBY_PLOT_RADIUS,
  orbitOverrides?: PlotOrbitOverrideMap,
): Set<string> {
  const selected = plots.find((plot) => plot.word_id === selectedId);
  if (!selected) {
    return new Set([selectedId]);
  }

  const [selectedX, selectedY, selectedZ] = plotPositionFromRow(
    selected,
    0,
    orbitOverrides?.get(selected.word_id),
  );
  const nearby = new Set<string>();

  for (const plot of plots) {
    const [x, y, z] = plotPositionFromRow(plot, 0, orbitOverrides?.get(plot.word_id));
    const distance = Math.hypot(x - selectedX, y - selectedY, z - selectedZ);
    if (distance <= radius) {
      nearby.add(plot.word_id);
    }
  }

  return nearby;
}

export function isPureEmotionPlot(row: UserPlotRow): boolean {
  return rowToEmotionParams(row).isPure;
}
