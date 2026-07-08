import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { UserPlotRow } from '../types/userPlot';
import {
  getNearbyPlotIds,
  isPureEmotionPlot,
  plotColorFromRow,
  plotPositionFromRow,
} from '../utils/plotFromUserPlot';
import { applySelectionViewOffset, clearSelectionViewOffset } from '../utils/cameraFocus';
import {
  EXPLORATION_CAMERA_DISTANCE,
  EXPLORATION_NEARBY_RADIUS,
  EXPLORATION_SCREEN_ANCHOR,
} from '../utils/explorationMode';
import { EmotionSpaceAreas } from './EmotionSpaceAreas';
import { GravityAttractionParticles } from './GravityAttractionParticles';
import { OrbitTrail } from './OrbitTrail';
import { WordPlot } from './WordPlot';

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 3, 18];
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];
const DEFAULT_CAMERA_FOV = 55;
const SELECTION_CAMERA_DISTANCE = 5;
const DEFAULT_CAMERA_DISTANCE = new THREE.Vector3(...DEFAULT_CAMERA_POSITION).distanceTo(
  new THREE.Vector3(...DEFAULT_CAMERA_TARGET),
);
const TARGET_LERP_SPEED = 6;
const TARGET_ARRIVAL_THRESHOLD = 0.2;
const ROTATION_SPEED = 0.006;
const WHEEL_ZOOM_SPEED = 0.0015;

type FocusPhase = 'idle' | 'movingTarget' | 'movingView' | 'adjustingZoom' | 'focused';

interface SpaceCanvasProps {
  plots: UserPlotRow[];
  selectedId: string | null;
  explorationMode?: boolean;
  onWordSelect: (id: string) => void;
}

interface CameraControlsProps {
  resetCount: number;
  cameraTarget: [number, number, number];
  focusOnSelection: boolean;
  explorationFocus?: boolean;
}

function CameraControls({
  resetCount,
  cameraTarget,
  focusOnSelection,
  explorationFocus = false,
}: CameraControlsProps) {
  const { camera, gl, size } = useThree();
  const baseTarget = useRef(new THREE.Vector3(...DEFAULT_CAMERA_TARGET));
  const desiredTarget = useRef(new THREE.Vector3(...DEFAULT_CAMERA_TARGET));
  const smoothTarget = useRef(new THREE.Vector3(...DEFAULT_CAMERA_TARGET));
  const viewOffsetProgress = useRef(0);
  const zoomProgress = useRef(0);
  const entryStartDistance = useRef(DEFAULT_CAMERA_DISTANCE);
  const cameraOffsetDirection = useRef(new THREE.Vector3());
  const cameraRight = useRef(new THREE.Vector3());
  const rotationAxis = useRef(new THREE.Vector3());
  const rotationQuaternion = useRef(new THREE.Quaternion());
  const dragState = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const focusPhase = useRef<FocusPhase>('idle');
  const prevFocusOnSelection = useRef(focusOnSelection);

  const focusDistance = explorationFocus ? EXPLORATION_CAMERA_DISTANCE : SELECTION_CAMERA_DISTANCE;
  const screenAnchor = explorationFocus ? EXPLORATION_SCREEN_ANCHOR : undefined;
  const enableRotate = !focusOnSelection || explorationFocus;
  const enableZoom = !focusOnSelection;

  const setFocusPhase = (phase: FocusPhase) => {
    focusPhase.current = phase;
  };

  useEffect(() => {
    baseTarget.current.set(...cameraTarget);

    if (!focusOnSelection) {
      setFocusPhase('idle');
      viewOffsetProgress.current = 0;
      zoomProgress.current = 0;

      if (camera instanceof THREE.PerspectiveCamera) {
        clearSelectionViewOffset(camera);
      }
    } else if (focusPhase.current === 'focused' && prevFocusOnSelection.current) {
      // 選択中の別単語切替: 注視点のみ更新
    } else if (focusPhase.current === 'idle' || !prevFocusOnSelection.current) {
      // 非選択 → 選択: 3段階シーケンスを最初から
      setFocusPhase('movingTarget');
      viewOffsetProgress.current = 0;
      zoomProgress.current = 0;

      if (camera instanceof THREE.PerspectiveCamera) {
        clearSelectionViewOffset(camera);
      }
    }

    prevFocusOnSelection.current = focusOnSelection;
  }, [cameraTarget, focusOnSelection, camera]);

  const applyCameraDistance = (distance: number, target: THREE.Vector3) => {
    cameraOffsetDirection.current.copy(camera.position).sub(target);
    if (cameraOffsetDirection.current.lengthSq() < 0.0001) {
      cameraOffsetDirection.current.set(...DEFAULT_CAMERA_POSITION).sub(target);
    }
    cameraOffsetDirection.current.normalize().multiplyScalar(distance);
    camera.position.copy(target).add(cameraOffsetDirection.current);
  };

  const rotateCameraAroundTarget = (deltaX: number, deltaY: number) => {
    const target = smoothTarget.current;
    const offset = cameraOffsetDirection.current.copy(camera.position).sub(target);
    if (offset.lengthSq() < 0.0001) return;

    cameraRight.current.setFromMatrixColumn(camera.matrix, 0).normalize();

    rotationQuaternion.current.setFromAxisAngle(camera.up, -deltaX * ROTATION_SPEED);
    offset.applyQuaternion(rotationQuaternion.current);
    camera.up.applyQuaternion(rotationQuaternion.current).normalize();

    rotationAxis.current.copy(cameraRight.current).normalize();
    rotationQuaternion.current.setFromAxisAngle(rotationAxis.current, -deltaY * ROTATION_SPEED);
    offset.applyQuaternion(rotationQuaternion.current);
    camera.up.applyQuaternion(rotationQuaternion.current).normalize();

    camera.position.copy(target).add(offset);
    camera.lookAt(target);
  };

  useEffect(() => {
    const element = gl.domElement;

    const handlePointerDown = (event: PointerEvent) => {
      if (!enableRotate || event.button !== 0) return;
      dragState.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      element.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragState.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      dragState.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      rotateCameraAroundTarget(deltaX, deltaY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = dragState.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragState.current = null;
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (!enableZoom) return;
      event.preventDefault();

      const target = smoothTarget.current;
      const offset = cameraOffsetDirection.current.copy(camera.position).sub(target);
      const scale = Math.exp(event.deltaY * WHEEL_ZOOM_SPEED);
      const distance = THREE.MathUtils.clamp(offset.length() * scale, 0.1, 1000);
      applyCameraDistance(distance, target);
      camera.lookAt(target);
    };

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerUp);
    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerUp);
      element.removeEventListener('wheel', handleWheel);
    };
  }, [camera, gl, enableRotate, enableZoom]);

  useFrame((_, delta) => {
    desiredTarget.current.copy(baseTarget.current);
    const lerpT = 1 - Math.exp(-TARGET_LERP_SPEED * delta);
    smoothTarget.current.lerp(desiredTarget.current, lerpT);

    const targetArrived =
      smoothTarget.current.distanceTo(desiredTarget.current) < TARGET_ARRIVAL_THRESHOLD;

    if (!focusOnSelection) {
      viewOffsetProgress.current = 0;
      zoomProgress.current = 0;

      if (camera instanceof THREE.PerspectiveCamera) {
        clearSelectionViewOffset(camera);
      }
    } else if (focusPhase.current === 'focused') {
      viewOffsetProgress.current = 1;
      zoomProgress.current = 1;

      if (camera instanceof THREE.PerspectiveCamera) {
        applySelectionViewOffset(camera, size.width, size.height, 1, screenAnchor);
      }
    } else if (focusPhase.current === 'movingTarget') {
      viewOffsetProgress.current = 0;
      zoomProgress.current = 0;

      if (camera instanceof THREE.PerspectiveCamera) {
        clearSelectionViewOffset(camera);
      }

      if (targetArrived) {
        setFocusPhase('movingView');
      }
    } else if (focusPhase.current === 'movingView') {
      viewOffsetProgress.current = THREE.MathUtils.lerp(viewOffsetProgress.current, 1, lerpT);

      if (viewOffsetProgress.current > 0.99) {
        viewOffsetProgress.current = 1;
        entryStartDistance.current = camera.position.distanceTo(smoothTarget.current);
        zoomProgress.current = 0;
        setFocusPhase('adjustingZoom');
      }

      if (camera instanceof THREE.PerspectiveCamera) {
        applySelectionViewOffset(camera, size.width, size.height, viewOffsetProgress.current, screenAnchor);
      }
    } else if (focusPhase.current === 'adjustingZoom') {
      viewOffsetProgress.current = 1;

      if (camera instanceof THREE.PerspectiveCamera) {
        applySelectionViewOffset(camera, size.width, size.height, 1, screenAnchor);
      }

      zoomProgress.current = THREE.MathUtils.lerp(zoomProgress.current, 1, lerpT);

      if (zoomProgress.current > 0.99) {
        zoomProgress.current = 1;
        setFocusPhase('focused');
      }
    }

    if (
      focusOnSelection &&
      (focusPhase.current === 'focused' || focusPhase.current === 'adjustingZoom')
    ) {
      const distance =
        focusPhase.current === 'focused'
          ? focusDistance
          : THREE.MathUtils.lerp(
              entryStartDistance.current,
              focusDistance,
              zoomProgress.current,
            );
      applyCameraDistance(distance, smoothTarget.current);
    }

    camera.lookAt(smoothTarget.current);
  });
  useEffect(() => {
    if (resetCount === 0) return;

    camera.position.set(...DEFAULT_CAMERA_POSITION);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = DEFAULT_CAMERA_FOV;
      clearSelectionViewOffset(camera);
      camera.updateProjectionMatrix();
    }

    desiredTarget.current.set(...DEFAULT_CAMERA_TARGET);
    baseTarget.current.set(...DEFAULT_CAMERA_TARGET);
    smoothTarget.current.set(...DEFAULT_CAMERA_TARGET);
    viewOffsetProgress.current = 0;
    zoomProgress.current = 0;
    setFocusPhase('idle');
    prevFocusOnSelection.current = false;
  }, [resetCount, camera]);

  return null;
}

export function SpaceCanvas({ plots, selectedId, explorationMode = false, onWordSelect }: SpaceCanvasProps) {
  const [resetCount, setResetCount] = useState(0);
  const [isDefaultView, setIsDefaultView] = useState(false);
  const selectedPlot = useMemo(
    () => plots.find((plot) => plot.word_id === selectedId) ?? null,
    [plots, selectedId],
  );

  const cameraTarget = useMemo((): [number, number, number] => {
    if (isDefaultView || !selectedId) {
      return DEFAULT_CAMERA_TARGET;
    }

    if (!selectedPlot) {
      return DEFAULT_CAMERA_TARGET;
    }

    return plotPositionFromRow(selectedPlot);
  }, [isDefaultView, selectedId, selectedPlot]);

  const nearbyPlotIds = useMemo(() => {
    if (!selectedId || isDefaultView) {
      return null;
    }

    if (explorationMode) {
      return getNearbyPlotIds(plots, selectedId, EXPLORATION_NEARBY_RADIUS);
    }

    return getNearbyPlotIds(plots, selectedId);
  }, [plots, selectedId, isDefaultView, explorationMode]);

  const sameEmotionOrbitPlots = useMemo(() => {
    if (!explorationMode || isDefaultView || !selectedPlot) {
      return [];
    }

    return plots.filter(
      (plot) =>
        plot.word_id !== selectedPlot.word_id &&
        plot.primaryId === selectedPlot.primaryId &&
        isPureEmotionPlot(plot),
    );
  }, [explorationMode, isDefaultView, plots, selectedPlot]);

  const isExplorationFocused = explorationMode && !isDefaultView && selectedId !== null;

  const handleWordSelect = (id: string) => {
    setIsDefaultView(false);
    onWordSelect(id);
  };

  useEffect(() => {
    if (selectedId) {
      setIsDefaultView(false);
    }
  }, [selectedId]);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#030508', position: 'relative' }}>
      {!explorationMode && (
        <button
          type="button"
          onClick={() => {
            setIsDefaultView(true);
            setResetCount((count) => count + 1);
          }}
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 1,
            padding: '10px 16px',
            border: '1px solid #1f2833',
            borderRadius: '8px',
            backgroundColor: 'rgba(11, 12, 16, 0.92)',
            color: '#45f3ff',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          カメラを基準点に戻す
        </button>
      )}

      <Canvas
        camera={{ position: DEFAULT_CAMERA_POSITION, fov: DEFAULT_CAMERA_FOV }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#030508']} />
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />

        <CameraControls
          resetCount={resetCount}
          cameraTarget={cameraTarget}
          focusOnSelection={isExplorationFocused || (!explorationMode && !isDefaultView && selectedId !== null)}
          explorationFocus={isExplorationFocused}
        />

        <EmotionSpaceAreas lite={explorationMode} />

        <Suspense fallback={null}>
          {explorationMode && selectedPlot && !isDefaultView && (
            <GravityAttractionParticles plot={selectedPlot} />
          )}
          {sameEmotionOrbitPlots.map((plot) => (
            <OrbitTrail
              key={`same-emotion-orbit-${plot.word_id}`}
              plot={plot}
              color={plotColorFromRow(plot)}
              isSelected
              isNearbyVisible
              particleTrail
            />
          ))}
          {plots.map((plot) => (
            <WordPlot
              key={plot.word_id}
              plot={plot}
              isSelected={plot.word_id === selectedId}
              isNearbyVisible={!nearbyPlotIds || nearbyPlotIds.has(plot.word_id)}
              explorationMode={explorationMode}
              onSelect={handleWordSelect}
            />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}
