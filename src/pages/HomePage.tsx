import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLandingLogo } from '../components/landing/MainLandingLogo';
import { HomeTutorialCanvas } from '../components/home/HomeTutorialCanvas';
import { HomeTutorialIntroPanel } from '../components/home/HomeTutorialIntroPanel';
import {
  HOME_TUTORIAL_CAMERA_TRANSITION_MS,
  HOME_TUTORIAL_PANEL_FADE_MS,
  HOME_TUTORIAL_STEPS,
} from '../components/home/homeTutorialConstants';
import { ROUTES } from '../routes/paths';
import { DEFAULT_EMOTION_UI_ACCENT, getEmotionUiTheme } from '../utils/emotionUiTheme';
import { getHomeTutorialUiLayout } from '../utils/homeTutorialUiLayout';

const UI_COLOR_TRANSITION =
  'border-color 320ms ease, background-color 320ms ease, color 320ms ease';

export function HomePage() {
  const mainRef = useRef<HTMLElement>(null);
  const [mainSize, setMainSize] = useState({ width: 0, height: 0 });
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [panelStepIndex, setPanelStepIndex] = useState(0);
  const [sphereScreenPoint, setSphereScreenPoint] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [isLandingChromeVisible, setIsLandingChromeVisible] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimersRef = useRef<number[]>([]);

  const uiTheme = useMemo(() => getEmotionUiTheme(DEFAULT_EMOTION_UI_ACCENT, 'dark'), []);
  const infoUi = useMemo(
    () => getHomeTutorialUiLayout(mainSize.width, mainSize.height),
    [mainSize.width, mainSize.height],
  );
  const { currentWordPanel } = infoUi;
  const activeStep = HOME_TUTORIAL_STEPS[activeStepIndex] ?? HOME_TUTORIAL_STEPS[0];
  const panelStep = HOME_TUTORIAL_STEPS[panelStepIndex] ?? HOME_TUTORIAL_STEPS[0];
  const panelContent = panelStep.content;
  const showIntroPanel = Boolean(panelContent && activeStep.showIntroPanel !== false);

  const clearTransitionTimers = useCallback(() => {
    transitionTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    transitionTimersRef.current = [];
  }, []);

  useEffect(() => {
    const element = mainRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      setMainSize({ width: element.clientWidth, height: element.clientHeight });
    };
    const observer = new ResizeObserver(updateSize);
    updateSize();
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => () => clearTransitionTimers(), [clearTransitionTimers]);

  const handleStepSelect = useCallback((nextIndex: number) => {
    if (
      isTransitioning ||
      nextIndex === activeStepIndex ||
      nextIndex < 0 ||
      nextIndex >= HOME_TUTORIAL_STEPS.length
    ) {
      return;
    }

    const currentStep = HOME_TUTORIAL_STEPS[activeStepIndex];
    const nextStep = HOME_TUTORIAL_STEPS[nextIndex];
    const leavingMain = currentStep.showLandingChrome === true;
    const enteringMain = nextStep.showLandingChrome === true;
    const enteringPanel = nextStep.showIntroPanel === true && nextStep.content;

    clearTransitionTimers();
    setIsTransitioning(true);

    if (enteringPanel) {
      setIsPanelVisible(false);
    } else if (!enteringMain) {
      setIsPanelVisible(false);
    }

    if (leavingMain) {
      setIsLandingChromeVisible(false);
    }

    const fadeDelay = enteringPanel || leavingMain || enteringMain ? HOME_TUTORIAL_PANEL_FADE_MS : 0;

    const startCameraMoveTimer = window.setTimeout(() => {
      setActiveStepIndex(nextIndex);
      setSphereScreenPoint(null);
    }, fadeDelay);

    const finishTimer = window.setTimeout(() => {
      if (enteringMain) {
        setIsLandingChromeVisible(true);
        setIsPanelVisible(false);
      } else if (enteringPanel && nextStep.content) {
        setPanelStepIndex(nextIndex);
        setIsPanelVisible(true);
      }
      setIsTransitioning(false);
    }, fadeDelay + HOME_TUTORIAL_CAMERA_TRANSITION_MS);

    transitionTimersRef.current = [startCameraMoveTimer, finishTimer];
  }, [activeStepIndex, clearTransitionTimers, isTransitioning]);

  const showGuideLine =
    showIntroPanel &&
    isPanelVisible &&
    !isTransitioning &&
    sphereScreenPoint?.visible &&
    mainSize.width > 0 &&
    mainSize.height > 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: uiTheme.uiText,
        backgroundColor: uiTheme.shell,
        overflow: 'hidden',
        transition: UI_COLOR_TRANSITION,
      }}
    >
      <style>
        {`
          @keyframes homeTutorialTicker {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-120%); }
          }
          @keyframes homeTutorialArrowPulse {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(4px); }
          }
        `}
      </style>

      <main ref={mainRef} style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <HomeTutorialCanvas
          activeStepIndex={activeStepIndex}
          onActiveSphereScreenPosition={setSphereScreenPoint}
          onStepSelect={handleStepSelect}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 'clamp(6%, 10vw, 14%)',
            pointerEvents: 'none',
            zIndex: 1,
            opacity: isLandingChromeVisible ? 1 : 0,
            transition: `opacity ${HOME_TUTORIAL_PANEL_FADE_MS}ms ease`,
          }}
        >
          <MainLandingLogo />
        </div>

        {showGuideLine && sphereScreenPoint && (
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${mainSize.width} ${mainSize.height}`}
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <line
              x1={sphereScreenPoint.x}
              y1={sphereScreenPoint.y}
              x2={currentWordPanel.x + currentWordPanel.width / 2}
              y2={currentWordPanel.y + currentWordPanel.height / 2}
              stroke={uiTheme.guideLine}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {panelContent && (
          <HomeTutorialIntroPanel
            uiTheme={uiTheme}
            panel={currentWordPanel}
            content={panelContent}
            visible={showIntroPanel && isPanelVisible}
          />
        )}

        <Link
          to={ROUTES.emotionMap}
          style={{
            position: 'absolute',
            right: '16px',
            bottom: '16px',
            zIndex: 3,
            padding: `${Math.round(8 * infoUi.scale)}px ${Math.round(14 * infoUi.scale)}px`,
            border: `1px solid ${uiTheme.controlBorder}`,
            borderRadius: `${Math.round(8 * infoUi.scale)}px`,
            backgroundColor: uiTheme.controlBackground,
            color: uiTheme.controlText,
            fontSize: `${(0.78 * infoUi.scale).toFixed(3)}rem`,
            letterSpacing: '0.06em',
            textDecoration: 'none',
            backdropFilter: 'blur(10px)',
          }}
        >
          感情MAPへ
        </Link>
      </main>
    </div>
  );
}
