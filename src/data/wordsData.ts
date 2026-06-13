import type { WordData } from '../types/word';

export const initialWords: WordData[] = [
  // 感情グループ
  { id: 'e1', text: '嬉しい', type: 'emotion', frequency: 70, angle: 0, intensity: 60 },
  { id: 'e2', text: '恐ろしい', type: 'emotion', frequency: 50, angle: 135, intensity: 90 },
  { id: 'e3', text: 'エモい', type: 'emotion', frequency: 80, angle: 45, intensity: 50 },

  // 状態グループ
  { id: 's1', text: '美しい', type: 'state', frequency: 60, perception: -2, quality: 8 },
  { id: 's2', text: 'キツい', type: 'state', frequency: 80, perception: 7, quality: -7 },
  { id: 's3', text: '複雑だ', type: 'state', frequency: 40, perception: -8, quality: 0 },
];
