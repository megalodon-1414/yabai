export const SITE_NAME = 'PLUTCHIKA';
export const SITE_DISPLAY_NAME = 'プルチカ';
export const SITE_NAME_RUBY = 'Plutchika';

export interface HomeTutorialStepContent {
  sectionLabel: string;
  ticker: string;
  title: string;
  titleRuby: string;
  body: string;
  note: string;
}

export interface HomeTutorialStepDefinition {
  id: string;
  /** このステップがアクティブのときの画面上の焦点（0〜1、左下が原点） */
  screenAnchor: { x: number; y: number };
  worldPosition: [number, number, number];
  /** カメラのヨー角（ラジアン）— ステップごとに少し変えると回転感が出る */
  cameraYaw?: number;
  /** カメラのピッチ角（ラジアン） */
  cameraPitch?: number;
  cameraDistance?: number;
  sphereColor: string;
  content: HomeTutorialStepContent;
}

/** 球の半径（大きくするほど点が大きい） */
export const HOME_TUTORIAL_SPHERE_RADIUS = 0.1;

export const HOME_TUTORIAL_STEPS: HomeTutorialStepDefinition[] = [
  {
    id: 'intro',
    screenAnchor: { x: 0.3, y: 0.6 },
    worldPosition: [0, 0.2, 0],
    cameraYaw: 0,
    cameraPitch: -0.04,
    sphereColor: '#c39bd3',
    content: {
      sectionLabel: 'はじまり',
      ticker: 'WELCOME',
      title: SITE_DISPLAY_NAME,
      titleRuby: SITE_NAME_RUBY,
      body:
        'プルチックの感情環に、「ヤバい」と感じる言葉を配置してたどる Web アプリです。左下の球を辿ると、このサイトのことを順に学べます。',
      note: 'ステップ 1 — サイトの名前と趣旨',
    },
  },
  {
    id: 'emotion-wheel',
    screenAnchor: { x: 0.3, y: 0.6 },
    worldPosition: [-1.05, -1.35, 0.2],
    cameraYaw: 0.16,
    cameraPitch: -0.07,
    sphereColor: '#8ecae6',
    content: {
      sectionLabel: 'つぎへ',
      ticker: 'STEP 02',
      title: '感情環',
      titleRuby: 'Emotion Wheel',
      body:
        'プルチックは 8 つの基本感情を環状に並べ、隣り合う感情が混ざり合うと複合感情が生まれると考えました。このサイトでは、その環を 3D 空間として辿ります。',
      note: 'ステップ 2 — プルチックの感情環',
    },
  },
];

/** @deprecated HOME_TUTORIAL_STEPS[0].content を使用 */
export const HOME_STEP_INTRO = HOME_TUTORIAL_STEPS[0].content;
