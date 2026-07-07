import * as THREE from 'three';

const FOG_COLOR = new THREE.Color('#030508');
export const ATMOSPHERE_NEAR_DISTANCE = 4;
export const ATMOSPHERE_FAR_DISTANCE = 18;
export const ATMOSPHERE_MIN_OPACITY = 0.22;
const NEAR_DISTANCE = ATMOSPHERE_NEAR_DISTANCE;
const FAR_DISTANCE = ATMOSPHERE_FAR_DISTANCE;
const MIN_OPACITY = ATMOSPHERE_MIN_OPACITY;
const SELECTED_MIN_OPACITY = 0.72;
const MAX_COLOR_MIX = 0.75;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export interface AtmosphericAppearance {
  opacity: number;
  color: THREE.Color;
}

export function getAtmosphericAppearance(
  distance: number,
  baseColor: THREE.Color,
  isSelected: boolean,
  target = new THREE.Color(),
): AtmosphericAppearance {
  const fade = smoothstep(NEAR_DISTANCE, FAR_DISTANCE, distance);
  const minOpacity = isSelected ? SELECTED_MIN_OPACITY : MIN_OPACITY;
  const opacity = THREE.MathUtils.lerp(1, minOpacity, fade);
  const colorMix = fade * (isSelected ? MAX_COLOR_MIX * 0.45 : MAX_COLOR_MIX);

  target.copy(baseColor).lerp(FOG_COLOR, colorMix);

  return { opacity, color: target };
}
