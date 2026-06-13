import type { EmotionWord, StateWord, WordData } from '../types/word';
import { spreadAngle, toPlotFrequency } from './plotTransform';

// プルチックの8基本感情に対応する色相（角度 → hue）
const PLUTCHIK_HUES: readonly [number, number][] = [
  [0, 48], // 喜び
  [45, 84], // 信頼
  [90, 134], // 恐れ
  [135, 180], // 驚き
  [180, 236], // 悲しみ
  [225, 280], // 嫌悪
  [270, 0], // 怒り
  [315, 24], // 期待
  [360, 48], // 喜び（一周）
];

function lerpHue(from: number, to: number, t: number): number {
  let diff = to - from;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (from + diff * t + 360) % 360;
}

function plutchikHue(angle: number): number {
  const normalized = ((angle % 360) + 360) % 360;

  for (let i = 0; i < PLUTCHIK_HUES.length - 1; i++) {
    const [startAngle, startHue] = PLUTCHIK_HUES[i];
    const [endAngle, endHue] = PLUTCHIK_HUES[i + 1];

    if (normalized >= startAngle && normalized <= endAngle) {
      const t = (normalized - startAngle) / (endAngle - startAngle);
      return lerpHue(startHue, endHue, t);
    }
  }

  return PLUTCHIK_HUES[0][1];
}

function frequencyToLightness(frequency: number): number {
  return 25 + (frequency / 100) * 55;
}

export function getEmotionColor(word: EmotionWord): string {
  const hue = plutchikHue(spreadAngle(word.angle, word.id));
  const saturation = word.intensity;
  const lightness = frequencyToLightness(toPlotFrequency(word.frequency));
  return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness.toFixed(1)}%)`;
}

export function getStateColor(word: StateWord): string {
  const hue = ((word.perception + 10) / 20) * 360;
  const saturation = (Math.abs(word.quality) / 10) * 100;
  const lightness = frequencyToLightness(word.frequency);
  return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness.toFixed(1)}%)`;
}

export function getWordColor(word: WordData): string {
  return word.type === 'emotion' ? getEmotionColor(word) : getStateColor(word);
}
