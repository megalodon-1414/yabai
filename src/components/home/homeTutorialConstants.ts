export const SITE_NAME = 'PLUTCHIKA';
export const SITE_DISPLAY_NAME = 'プルチカ';
export const SITE_NAME_RUBY = 'Plutchika';

/** メイン画面の感情環が置かれる画面上の位置（0〜1、左下が原点） */
export const HOME_MAIN_SCREEN_ANCHOR = { x: 0.28, y: 0.52 };
/** STEP1 がアクティブのとき、点が来る画面位置（左側） */
export const HOME_STEP1_SCREEN_ANCHOR = { x: 0.28, y: 0.52 };
/** STEP0 のとき、STEP1 の点が見える想定位置（やや右寄り中央下）— worldPosition 調整の目安 */
export const HOME_STEP1_PREVIEW_ANCHOR = { x: 0.62, y: 0.34 };

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
  cameraYaw?: number;
  cameraPitch?: number;
  cameraDistance?: number;
  sphereColor: string;
  /** メイン画面の環＋ロゴオーバーレイを表示 */
  showLandingChrome?: boolean;
  /** 右側のチュートリアル UI パネルを表示 */
  showIntroPanel?: boolean;
  content?: HomeTutorialStepContent;
}

/** 球の半径（大きくするほど点が大きい） */
export const HOME_TUTORIAL_SPHERE_RADIUS = 0.12;
export const HOME_TUTORIAL_ACTIVE_SPHERE_SCALE = 1.22;
export const HOME_TUTORIAL_HOVER_SPHERE_SCALE = 1.16;
export const HOME_TUTORIAL_ACTIVE_HOVER_SCALE_BOOST = 1.06;

export const HOME_TUTORIAL_PANEL_FADE_MS = 420;
export const HOME_TUTORIAL_CAMERA_TRANSITION_MS = 1150;

export const HOME_TUTORIAL_STEPS: HomeTutorialStepDefinition[] = [
  {
    id: 'main',
    screenAnchor: HOME_MAIN_SCREEN_ANCHOR,
    worldPosition: [0, 0, 0],
    cameraYaw: 0,
    cameraPitch: -0.04,
    sphereColor: '#e8dff0',
    showLandingChrome: true,
    showIntroPanel: false,
  },
  {
    id: 'intro',
    screenAnchor: HOME_STEP1_SCREEN_ANCHOR,
    /** STEP0 視点では右寄り中央下、STEP1 視点では左（screenAnchor） */
    worldPosition: [0.95, -1.65, 0.08],
    cameraYaw: 0,
    cameraPitch: -0.05,
    sphereColor: '#c39bd3',
    showIntroPanel: true,
    content: {
      sectionLabel: 'はじまり',
      ticker: 'WELCOME',
      title: SITE_DISPLAY_NAME,
      titleRuby: SITE_NAME_RUBY,
      body:
        'プルチックの感情環に、「ヤバい」と感じる言葉を配置してたどる Web アプリです。画面下の球を辿ると、このサイトのことを順に学べます。',
      note: 'ステップ 1 — サイトの名前と趣旨',
    },
  },
  {
    id: 'emotion-wheel',
    screenAnchor: HOME_STEP1_SCREEN_ANCHOR,
    worldPosition: [-1.15, -2.05, 0.1],
    cameraYaw: 0.14,
    cameraPitch: -0.07,
    sphereColor: '#8ecae6',
    showIntroPanel: true,
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

/** @deprecated HOME_TUTORIAL_STEPS[1].content を使用 */
export const HOME_STEP_INTRO = HOME_TUTORIAL_STEPS[1].content!;
