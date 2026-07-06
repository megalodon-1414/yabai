import { DYADS, PRIMARY_EMOTIONS, type PrimaryEmotion } from './emotions';
import {
  DYAD_RADIAL_SCALE,
  expandFromOrigin,
  getAllPrimaryPositions,
  midpoint,
  type Vec3,
} from './geometry';

export type AnchorKind = 'primary' | 'dyad';

export interface EmotionAnchor {
  id: string;
  kind: AnchorKind;
  label: string;
  position: Vec3;
  emotions: PrimaryEmotion[];
  dyadDistance?: 1 | 2 | 3;
}

const primaryPositions = getAllPrimaryPositions();

export const PRIMARY_ANCHORS: EmotionAnchor[] = PRIMARY_EMOTIONS.map((emotion) => ({
  id: `primary-${emotion}`,
  kind: 'primary',
  label: emotion,
  position: primaryPositions[emotion],
  emotions: [emotion],
}));

export const DYAD_ANCHORS: EmotionAnchor[] = DYADS.map((dyad) => ({
  id: dyad.id,
  kind: 'dyad',
  label: dyad.label,
  position: expandFromOrigin(
    midpoint(primaryPositions[dyad.emotions[0]], primaryPositions[dyad.emotions[1]]),
    DYAD_RADIAL_SCALE[dyad.distance],
  ),
  emotions: [...dyad.emotions],
  dyadDistance: dyad.distance,
}));

export const ALL_ANCHORS: EmotionAnchor[] = [...PRIMARY_ANCHORS, ...DYAD_ANCHORS];

export function getPrimaryAnchor(emotion: PrimaryEmotion): EmotionAnchor {
  return PRIMARY_ANCHORS[PRIMARY_EMOTIONS.indexOf(emotion)];
}
