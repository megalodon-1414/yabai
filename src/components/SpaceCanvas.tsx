import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { UserPlotRow } from '../types/userPlot';
import { getNearbyPlotIds, plotPositionFromRow } from '../utils/plotFromUserPlot';
import { applySelectionViewOffset, clearSelectionViewOffset } from '../utils/cameraFocus';
import { SpaceDots3D } from './SpaceDots3D';
import { WordPlot } from './WordPlot';

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 5, 8];
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 1.5, 0];
const DEFAULT_CAMERA_FOV = 60;
const SELECTION_CAMERA_DISTANCE = 2;
const DEFAULT_CAMERA_DISTANCE = new THREE.Vector3(...DEFAULT_CAMERA_POSITION).distanceTo(
  new THREE.Vector3(...DEFAULT_CAMERA_TARGET),
);
const TARGET_LERP_SPEED = 6;
const TARGET_ARRIVAL_THRESHOLD = 0.2;

type FocusPhase = 'idle' | 'movingTarget' | 'movingView' | 'adjustingZoom' | 'focused';

interface SpaceCanvasProps {
  plots: UserPlotRow[];
  currentMode: 'emotion' | 'state';
  selectedId: string | null;
  onWordSelect: (id: string) => void;
}

interface CameraControlsProps {
  resetCount: number;
  cameraTarget: [number, number, number];
  focusOnSelection: boolean;
}

function CameraControls({ resetCount, cameraTarget, focusOnSelection }: CameraControlsProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const [orbitDistanceLocked, setOrbitDistanceLocked] = useState(false);
  const baseTarget = useRef(new THREE.Vector3(...DEFAULT_CAMERA_TARGET));
  const desiredTarget = useRef(new THREE.Vector3(...DEFAULT_CAMERA_TARGET));
  const smoothTarget = useRef(new THREE.Vector3(...DEFAULT_CAMERA_TARGET));
  const viewOffsetProgress = useRef(0);
  const zoomProgress = useRef(0);
  const entryStartDistance = useRef(DEFAULT_CAMERA_DISTANCE);
  const cameraOffsetDirection = useRef(new THREE.Vector3());
  const focusPhase = useRef<FocusPhase>('idle');
  const prevFocusOnSelection = useRef(focusOnSelection);

  const setFocusPhase = (phase: FocusPhase) => {
    focusPhase.current = phase;
    if (phase === 'focused') {
      setOrbitDistanceLocked(true);
    } else if (phase === 'idle') {
      setOrbitDistanceLocked(false);
    }
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

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    desiredTarget.current.copy(baseTarget.current);
    const lerpT = 1 - Math.exp(-TARGET_LERP_SPEED * delta);
    smoothTarget.current.lerp(desiredTarget.current, lerpT);
    controls.target.copy(smoothTarget.current);

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
        applySelectionViewOffset(camera, size.width, size.height, 1);
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
        entryStartDistance.current = camera.position.distanceTo(controls.target);
        zoomProgress.current = 0;
        setFocusPhase('adjustingZoom');
      }

      if (camera instanceof THREE.PerspectiveCamera) {
        applySelectionViewOffset(camera, size.width, size.height, viewOffsetProgress.current);
      }
    } else if (focusPhase.current === 'adjustingZoom') {
      viewOffsetProgress.current = 1;

      if (camera instanceof THREE.PerspectiveCamera) {
        applySelectionViewOffset(camera, size.width, size.height, 1);
      }

      zoomProgress.current = THREE.MathUtils.lerp(zoomProgress.current, 1, lerpT);

      if (zoomProgress.current > 0.99) {
        zoomProgress.current = 1;
        setFocusPhase('focused');
      }
    }

    controls.update();

    if (
      focusOnSelection &&
      (focusPhase.current === 'focused' || focusPhase.current === 'adjustingZoom')
    ) {
      const distance =
        focusPhase.current === 'focused'
          ? SELECTION_CAMERA_DISTANCE
          : THREE.MathUtils.lerp(
              entryStartDistance.current,
              SELECTION_CAMERA_DISTANCE,
              zoomProgress.current,
            );
      applyCameraDistance(distance, controls.target);
    }
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

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      enablePan={false}
      enableZoom={!focusOnSelection}
      minDistance={orbitDistanceLocked ? SELECTION_CAMERA_DISTANCE : 0.1}
      maxDistance={orbitDistanceLocked ? SELECTION_CAMERA_DISTANCE : 1000}
    />
  );
}

export function SpaceCanvas({ plots, currentMode, selectedId, onWordSelect }: SpaceCanvasProps) {  const [resetCount, setResetCount] = useState(0);
  const [isDefaultView, setIsDefaultView] = useState(false);

  const cameraTarget = useMemo((): [number, number, number] => {
    if (isDefaultView || !selectedId) {
      return DEFAULT_CAMERA_TARGET;
    }

    const selected = plots.find((plot) => plot.word_id === selectedId && plot.mode === currentMode);
    if (!selected) {
      return DEFAULT_CAMERA_TARGET;
    }

    return plotPositionFromRow(selected);
  }, [isDefaultView, selectedId, plots, currentMode]);

  const nearbyPlotIds = useMemo(() => {
    if (!selectedId || isDefaultView) {
      return null;
    }

    return getNearbyPlotIds(plots, selectedId, currentMode);
  }, [plots, selectedId, currentMode, isDefaultView]);

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
    <div style={{ width: '100%', height: '100%', backgroundColor: '#0b0c10', position: 'relative' }}>
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

      <Canvas
        camera={{ position: DEFAULT_CAMERA_POSITION, fov: DEFAULT_CAMERA_FOV }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#0b0c10']} />
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} />

        <CameraControls
          resetCount={resetCount}
          cameraTarget={cameraTarget}
          focusOnSelection={!isDefaultView && selectedId !== null}
        />

        <Suspense fallback={null}>
          {plots.map((plot) => (
            <WordPlot
              key={plot.word_id}
              plot={plot}
              currentMode={currentMode}
              isSelected={plot.word_id === selectedId}
              isNearbyVisible={!nearbyPlotIds || nearbyPlotIds.has(plot.word_id)}
              onSelect={handleWordSelect}
            />
          ))}
        </Suspense>

        <SpaceDots3D currentMode={currentMode} />
      </Canvas>
    </div>
  );
}
