export const PRIMARY_EMOTIONS = [
  'joy',
  'trust',
  'fear',
  'surprise',
  'sadness',
  'disgust',
  'anger',
  'anticipation',
] as const;

export type PrimaryEmotion = (typeof PRIMARY_EMOTIONS)[number];

export const EMOTION_LABELS: Record<PrimaryEmotion, string> = {
  joy: '喜び',
  trust: '信頼',
  fear: '恐れ',
  surprise: '驚き',
  sadness: '悲しみ',
  disgust: '嫌悪',
  anger: '怒り',
  anticipation: '期待',
};

export const EMOTION_HUES: Record<PrimaryEmotion, number> = {
  joy: 48,
  trust: 85,
  fear: 265,
  surprise: 195,
  sadness: 220,
  disgust: 130,
  anger: 5,
  anticipation: 35,
};

/** プルチック環上のインデックス (0=喜び, 時計回り) */
export function emotionIndex(emotion: PrimaryEmotion): number {
  return PRIMARY_EMOTIONS.indexOf(emotion);
}

/** 環上の隣接感情（距離1） */
export function wheelNeighbors(emotion: PrimaryEmotion): PrimaryEmotion[] {
  const i = emotionIndex(emotion);
  const n = PRIMARY_EMOTIONS.length;
  return [PRIMARY_EMOTIONS[(i - 1 + n) % n], PRIMARY_EMOTIONS[(i + 1) % n]];
}

/** 環上の距離 (1〜4) */
export function wheelDistance(a: PrimaryEmotion, b: PrimaryEmotion): number {
  const diff = Math.abs(emotionIndex(a) - emotionIndex(b));
  return Math.min(diff, PRIMARY_EMOTIONS.length - diff);
}

export interface DyadDefinition {
  id: string;
  label: string;
  emotions: [PrimaryEmotion, PrimaryEmotion];
  distance: 1 | 2 | 3;
}

/** プルチック24応用感情: 環距離1・2・3 それぞれ8組 */
export const DYADS: DyadDefinition[] = (() => {
  const dyads: DyadDefinition[] = [];
  const primaryDyadLabels: Record<string, string> = {
    'joy-trust': '愛',
    'trust-fear': '降伏',
    'fear-surprise': '畏怖',
    'surprise-sadness': '不承認',
    'sadness-disgust': '悔恨',
    'disgust-anger': '軽蔑',
    'anger-anticipation': '攻撃性',
    'anticipation-joy': '楽観',
  };
  const secondaryDyadLabels: Record<string, string> = {
    'joy-fear': '罪悪感',
    'trust-surprise': '好奇心',
    'fear-sadness': '絶望',
    'surprise-disgust': '違和感',
    'sadness-anger': '侮蔑',
    'anticipation-disgust': '悲観',
    'anger-joy': '陰鬱',
    'anticipation-trust': '希望',
  };
  const tertiaryDyadLabels: Record<string, string> = {
    'joy-surprise': '歓喜',
    'sadness-trust': '懐念',
    'disgust-fear': '忌避',
    'anger-surprise': '不信',
    'anticipation-sadness': '羨望',
    'disgust-joy': '皮肉',
    'anger-trust': '支配',
    'anticipation-fear': '不安',
  };

  const pairKey = (a: PrimaryEmotion, b: PrimaryEmotion) =>
    emotionIndex(a) < emotionIndex(b) ? `${a}-${b}` : `${b}-${a}`;

  for (let i = 0; i < PRIMARY_EMOTIONS.length; i += 1) {
    for (let dist = 1; dist <= 3; dist += 1) {
      const j = (i + dist) % PRIMARY_EMOTIONS.length;
      const a = PRIMARY_EMOTIONS[i];
      const b = PRIMARY_EMOTIONS[j];
      const key = pairKey(a, b);
      const labelMap = dist === 1 ? primaryDyadLabels : dist === 2 ? secondaryDyadLabels : tertiaryDyadLabels;
      dyads.push({
        id: `dyad-${key}`,
        label: labelMap[key] ?? key,
        emotions: emotionIndex(a) < emotionIndex(b) ? [a, b] : [b, a],
        distance: dist as 1 | 2 | 3,
      });
    }
  }

  return dyads;
})();
