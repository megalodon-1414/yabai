import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getBasicEmotion } from '../data/emotions';
import type { UserPlotRow } from '../types/userPlot';
import {
  createMixedPlotOrbitOverrides,
  getNearbyPlotIds,
  isPureEmotionPlot,
  plotColorFromRow,
  plotPositionFromRow,
  type PlotOrbitOverride,
} from '../utils/plotFromUserPlot';
import type { AppBackgroundTheme } from '../utils/appBackgroundTheme';
import { getBackgroundThemeColors } from '../utils/appBackgroundTheme';
import type { PlotLabelDisplayMode } from '../utils/plotLabelStyle';
import { applySelectionViewOffset, clearSelectionViewOffset } from '../utils/cameraFocus';
import { setAtmosphereFogColor } from '../utils/plotAtmosphere';
import { getPrimaryEmotionColor, rowToEmotionParams } from '../utils/emotionPlotBridge';
import {
  EXPLORATION_CAMERA_DISTANCE,
  EXPLORATION_NEARBY_RADIUS,
  EXPLORATION_SCREEN_ANCHOR,
} from '../utils/explorationMode';
import { getEmotionCenter } from '../utils/emotionSpaceLayout';
import type { MinimapSyncState } from '../utils/emotionMinimapLayout';
import { EmotionSpaceAreas } from './EmotionSpaceAreas';
import { ExplorationDistantPlotCloud } from './ExplorationDistantPlotCloud';
import { GravityAttractionParticles } from './GravityAttractionParticles';
import { OrbitTrail } from './OrbitTrail';
import { WarpGate } from './WarpGate';
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
const EXPLORATION_ORBIT_CAMERA_DISTANCE = 1.3;
const EXPLORATION_MIXED_ORBIT_CAMERA_DISTANCE = 0.68;
const SELECTED_ORBIT_TIME_SCALE = 0.18;

type FocusPhase = 'idle' | 'movingTarget' | 'movingView' | 'adjustingZoom' | 'focused';

interface WarpGateEntry {
  key: string;
  plot: UserPlotRow;
  orbitOverride?: PlotOrbitOverride;
  sourceOverride?: [number, number, number];
  active: boolean;
}

interface SpaceCanvasProps {
  plots: UserPlotRow[];
  selectedId: string | null;
  explorationMode?: boolean;
  flowLabelExpiresAt?: Readonly<Record<string, number>>;
  flowLabelNow?: number;
  plotLabelDisplayMode?: PlotLabelDisplayMode;
  backgroundTheme?: AppBackgroundTheme;
  onSelectedScreenPosition?: (point: { x: number; y: number; visible: boolean } | null) => void;
  onHoveredWordChange?: (wordId: string | null) => void;
  onHoveredWarpGateChange?: (label: string | null) => void;
  onHoveredScreenPosition?: (point: { x: number; y: number; visible: boolean } | null) => void;
  onMinimapSync?: (state: MinimapSyncState | null) => void;
  onWordSelect: (id: string) => void;
}

interface CameraControlsProps {
  resetCount: number;
  cameraTarget: [number, number, number];
  focusOnSelection: boolean;
  explorationFocus?: boolean;
  explorationAnchor?: { x: number; y: number };
  explorationDistance?: number;
  onCameraStateChange?: (state: Pick<MinimapSyncState, 'cameraPosition' | 'cameraTarget' | 'cameraUp'>) => void;
}

function CameraControls({
  resetCount,
  cameraTarget,
  focusOnSelection,
  explorationFocus = false,
  explorationAnchor = EXPLORATION_SCREEN_ANCHOR,
  explorationDistance = EXPLORATION_CAMERA_DISTANCE,
  onCameraStateChange,
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
  const frameCounter = useRef(0);
  const lastCameraState = useRef<Pick<MinimapSyncState, 'cameraPosition' | 'cameraTarget' | 'cameraUp'> | null>(null);

  const focusDistance = explorationFocus ? explorationDistance : SELECTION_CAMERA_DISTANCE;
  const screenAnchor = explorationFocus ? explorationAnchor : undefined;
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
  }, [cameraTarget, focusOnSelection, explorationAnchor, camera]);

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

    if (onCameraStateChange) {
      frameCounter.current = (frameCounter.current + 1) % 2;
      if (frameCounter.current === 0) {
        const next = {
          cameraPosition: [camera.position.x, camera.position.y, camera.position.z] as [number, number, number],
          cameraTarget: [smoothTarget.current.x, smoothTarget.current.y, smoothTarget.current.z] as [
            number,
            number,
            number,
          ],
          cameraUp: [camera.up.x, camera.up.y, camera.up.z] as [number, number, number],
        };
        lastCameraState.current = next;
        onCameraStateChange(next);
      }
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

  return null;
}

interface SelectedScreenPointTrackerProps {
  plot: UserPlotRow | null;
  active: boolean;
  orbitOverride?: PlotOrbitOverride;
  orbitTimeScale?: number;
  onChange?: (point: { x: number; y: number; visible: boolean } | null) => void;
}

function SelectedScreenPointTracker({
  plot,
  active,
  orbitOverride,
  orbitTimeScale = 1,
  onChange,
}: SelectedScreenPointTrackerProps) {
  const { camera, size } = useThree();
  const projected = useRef(new THREE.Vector3());
  const lastPoint = useRef<{ x: number; y: number; visible: boolean } | null>(null);
  const frameCounter = useRef(0);

  useEffect(() => {
    if (!active || !plot) {
      lastPoint.current = null;
      onChange?.(null);
    }
  }, [active, plot, onChange]);

  useFrame((state) => {
    if (!active || !plot || !onChange) return;
    frameCounter.current = (frameCounter.current + 1) % 2;
    if (frameCounter.current !== 0) return;

    projected.current
      .set(...plotPositionFromRow(plot, state.clock.elapsedTime * orbitTimeScale, orbitOverride))
      .project(camera);
    const next = {
      x: (projected.current.x * 0.5 + 0.5) * size.width,
      y: (-projected.current.y * 0.5 + 0.5) * size.height,
      visible: projected.current.z >= -1 && projected.current.z <= 1,
    };
    const prev = lastPoint.current;
    const moved = !prev || Math.hypot(prev.x - next.x, prev.y - next.y) > 0.75 || prev.visible !== next.visible;

    if (moved) {
      lastPoint.current = next;
      onChange(next);
    }
  });

  return null;
}

interface MinimapFocusTrackerProps {
  plot: UserPlotRow | null;
  active: boolean;
  orbitOverride?: PlotOrbitOverride;
  orbitTimeScale?: number;
  cameraState: Pick<MinimapSyncState, 'cameraPosition' | 'cameraTarget' | 'cameraUp'> | null;
  onChange?: (state: MinimapSyncState | null) => void;
}

function MinimapFocusTracker({
  plot,
  active,
  orbitOverride,
  orbitTimeScale = 1,
  cameraState,
  onChange,
}: MinimapFocusTrackerProps) {
  const frameCounter = useRef(0);

  useEffect(() => {
    if (!active || !plot || !cameraState) {
      onChange?.(null);
    }
  }, [active, plot, cameraState, onChange]);

  useFrame((state) => {
    if (!active || !plot || !cameraState || !onChange) return;

    frameCounter.current = (frameCounter.current + 1) % 2;
    if (frameCounter.current !== 0) return;

    const focusPosition = plotPositionFromRow(
      plot,
      state.clock.elapsedTime * orbitTimeScale,
      orbitOverride,
    ) as [number, number, number];

    onChange({
      ...cameraState,
      focusPosition,
      primaryId: plot.primaryId,
    });
  });

  return null;
}

export function SpaceCanvas({
  plots,
  selectedId,
  explorationMode = false,
  flowLabelExpiresAt,
  flowLabelNow = 0,
  plotLabelDisplayMode = 'flow',
  backgroundTheme = 'dark',
  onSelectedScreenPosition,
  onHoveredWordChange,
  onHoveredWarpGateChange,
  onHoveredScreenPosition,
  onMinimapSync,
  onWordSelect,
}: SpaceCanvasProps) {
  const [resetCount, setResetCount] = useState(0);
  const [cameraState, setCameraState] = useState<Pick<
    MinimapSyncState,
    'cameraPosition' | 'cameraTarget' | 'cameraUp'
  > | null>(null);
  const [isDefaultView, setIsDefaultView] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const selectedPlot = useMemo(
    () => plots.find((plot) => plot.word_id === selectedId) ?? null,
    [plots, selectedId],
  );
  const hoveredPlot = useMemo(
    () => plots.find((plot) => plot.word_id === hoveredId) ?? null,
    [plots, hoveredId],
  );
  const mixedOrbitOverrides = useMemo(() => createMixedPlotOrbitOverrides(plots), [plots]);
  const isSelectedOrbitingPlot = explorationMode && selectedPlot ? isPureEmotionPlot(selectedPlot) : false;
  const selectedMixedOrbit = selectedPlot ? mixedOrbitOverrides.get(selectedPlot.word_id) : undefined;
  const selectedOrbitCenter = useMemo((): [number, number, number] | null => {
    if (!isSelectedOrbitingPlot || !selectedPlot) {
      return null;
    }

    const center = getEmotionCenter(selectedPlot.primaryId);
    return [center.x, center.y, center.z];
  }, [isSelectedOrbitingPlot, selectedPlot?.primaryId]);

  const cameraTarget = useMemo((): [number, number, number] => {
    if (isDefaultView || !selectedId) {
      return DEFAULT_CAMERA_TARGET;
    }

    if (!selectedPlot) {
      return DEFAULT_CAMERA_TARGET;
    }

    if (selectedOrbitCenter) {
      return selectedOrbitCenter;
    }

    if (selectedMixedOrbit) {
      return selectedMixedOrbit.center;
    }

    return plotPositionFromRow(selectedPlot, 0, selectedMixedOrbit);
  }, [isDefaultView, selectedId, selectedPlot, selectedOrbitCenter, selectedMixedOrbit]);

  const nearbyPlotIds = useMemo(() => {
    if (!selectedId || isDefaultView) {
      return null;
    }

    if (explorationMode) {
      return getNearbyPlotIds(plots, selectedId, EXPLORATION_NEARBY_RADIUS, mixedOrbitOverrides);
    }

    return getNearbyPlotIds(plots, selectedId, undefined, mixedOrbitOverrides);
  }, [plots, selectedId, isDefaultView, explorationMode, mixedOrbitOverrides]);

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

  const interactivePlots = useMemo(() => {
    if (!explorationMode || !nearbyPlotIds) {
      return plots;
    }

    return plots.filter((plot) => plot.word_id === selectedId || nearbyPlotIds.has(plot.word_id));
  }, [explorationMode, nearbyPlotIds, plots, selectedId]);

  const distantPlots = useMemo(() => {
    if (!explorationMode || !nearbyPlotIds) {
      return [];
    }

    return plots.filter((plot) => plot.word_id !== selectedId && !nearbyPlotIds.has(plot.word_id));
  }, [explorationMode, nearbyPlotIds, plots, selectedId]);

  const isExplorationFocused = explorationMode && !isDefaultView && selectedId !== null;

  const warpGatePlots = useMemo(() => {
    if (!explorationMode || isDefaultView) {
      return [];
    }

    const strongestByPair = new Map<string, number>();
    for (const plot of plots) {
      const params = rowToEmotionParams(plot);
      if (params.isPure) {
        continue;
      }

      const key = `${params.primaryId}:${params.secondaryId}`;
      strongestByPair.set(key, Math.max(strongestByPair.get(key) ?? -Infinity, params.intensity));
    }

    return plots.filter((plot) => {
      const params = rowToEmotionParams(plot);
      if (params.isPure) {
        return false;
      }

      const key = `${params.primaryId}:${params.secondaryId}`;
      const strongestIntensity = strongestByPair.get(key) ?? -Infinity;
      const hasWarpTarget = plots.some(
        (targetPlot) => isPureEmotionPlot(targetPlot) && targetPlot.primaryId === params.secondaryId,
      );

      return hasWarpTarget && params.intensity >= strongestIntensity;
    });
  }, [explorationMode, isDefaultView, plots]);

  const selectedWarpGatePlot = useMemo(() => {
    if (!selectedPlot) {
      return null;
    }

    if (selectedMixedOrbit) {
      return warpGatePlots.find((plot) => {
        const orbitOverride = mixedOrbitOverrides.get(plot.word_id);
        return orbitOverride?.groupKey === selectedMixedOrbit.groupKey;
      }) ?? null;
    }

    return warpGatePlots.find((plot) => plot.word_id === selectedPlot.word_id) ?? null;
  }, [mixedOrbitOverrides, selectedMixedOrbit, selectedPlot, warpGatePlots]);

  const warpGateTargets = useMemo(() => {
    if (!selectedWarpGatePlot) {
      return [];
    }

    const params = rowToEmotionParams(selectedWarpGatePlot);
    return plots.filter((plot) => isPureEmotionPlot(plot) && plot.primaryId === params.secondaryId);
  }, [plots, selectedWarpGatePlot]);

  const visibleWarpGateEntries = useMemo((): WarpGateEntry[] => {
    const entries: WarpGateEntry[] = [];
    const seenGroups = new Set<string>();

    for (const plot of warpGatePlots) {
      const orbitOverride = mixedOrbitOverrides.get(plot.word_id);
      const active =
        orbitOverride && selectedMixedOrbit
          ? orbitOverride.groupKey === selectedMixedOrbit.groupKey
          : plot.word_id === selectedId;

      if (orbitOverride) {
        if (seenGroups.has(orbitOverride.groupKey)) {
          continue;
        }
        seenGroups.add(orbitOverride.groupKey);

        const groupIsNearby = plots.some((candidate) => {
          const candidateOverride = mixedOrbitOverrides.get(candidate.word_id);
          return candidateOverride?.groupKey === orbitOverride.groupKey && nearbyPlotIds?.has(candidate.word_id);
        });

        if (!active && !groupIsNearby) {
          continue;
        }

        entries.push({
          key: `warp-gate-group-${orbitOverride.groupKey}`,
          plot,
          orbitOverride,
          sourceOverride: orbitOverride.center,
          active: Boolean(active),
        });
        continue;
      }

      if (!active && (!nearbyPlotIds || !nearbyPlotIds.has(plot.word_id))) {
        continue;
      }

      entries.push({
        key: `warp-gate-${plot.word_id}`,
        plot,
        active: Boolean(active),
      });
    }

    return entries;
  }, [mixedOrbitOverrides, nearbyPlotIds, selectedId, selectedMixedOrbit, warpGatePlots]);

  const handleWarpGateSelect = useCallback(() => {
    if (warpGateTargets.length === 0) {
      return;
    }

    const target = warpGateTargets[Math.floor(Math.random() * warpGateTargets.length)];
    if (!target) {
      return;
    }

    setIsDefaultView(false);
    onWordSelect(target.word_id);
  }, [onWordSelect, warpGateTargets]);

  const getOrbitTimeScale = (plot: UserPlotRow | null): number =>
    isSelectedOrbitingPlot && selectedPlot && plot && isPureEmotionPlot(plot) && plot.primaryId === selectedPlot.primaryId
      ? SELECTED_ORBIT_TIME_SCALE
      : 1;

  const handleWordSelect = (id: string) => {
    setIsDefaultView(false);
    onWordSelect(id);
  };

  const handleWordHover = (id: string | null) => {
    setHoveredId(id);
    onHoveredWordChange?.(id);
  };

  const handleCameraStateChange = useCallback(
    (state: Pick<MinimapSyncState, 'cameraPosition' | 'cameraTarget' | 'cameraUp'>) => {
      setCameraState(state);
    },
    [],
  );

  const handleMinimapSync = useCallback(
    (state: MinimapSyncState | null) => {
      onMinimapSync?.(state);
    },
    [onMinimapSync],
  );

  useEffect(() => {
    if (selectedId) {
      setIsDefaultView(false);
    }
  }, [selectedId]);

  const backgroundColors = getBackgroundThemeColors(backgroundTheme);

  useEffect(() => {
    setAtmosphereFogColor(backgroundColors.canvas);
  }, [backgroundColors.canvas]);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: backgroundColors.canvas, position: 'relative' }}>
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
        dpr={explorationMode ? [1, 1.25] : [1, 2]}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[backgroundColors.canvas]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />

        <CameraControls
          resetCount={resetCount}
          cameraTarget={cameraTarget}
          focusOnSelection={isExplorationFocused || (!explorationMode && !isDefaultView && selectedId !== null)}
          explorationFocus={isExplorationFocused}
          explorationAnchor={EXPLORATION_SCREEN_ANCHOR}
          explorationDistance={
            isSelectedOrbitingPlot
              ? EXPLORATION_ORBIT_CAMERA_DISTANCE
              : selectedMixedOrbit
                ? EXPLORATION_MIXED_ORBIT_CAMERA_DISTANCE
                : EXPLORATION_CAMERA_DISTANCE
          }
          onCameraStateChange={handleCameraStateChange}
        />
        <MinimapFocusTracker
          plot={selectedPlot}
          active={!isDefaultView && selectedPlot !== null}
          orbitOverride={selectedPlot ? mixedOrbitOverrides.get(selectedPlot.word_id) : undefined}
          orbitTimeScale={getOrbitTimeScale(selectedPlot)}
          cameraState={cameraState}
          onChange={handleMinimapSync}
        />
        <SelectedScreenPointTracker
          plot={selectedPlot}
          active={explorationMode && !isDefaultView && selectedPlot !== null}
          orbitOverride={selectedPlot ? mixedOrbitOverrides.get(selectedPlot.word_id) : undefined}
          orbitTimeScale={getOrbitTimeScale(selectedPlot)}
          onChange={onSelectedScreenPosition}
        />
        <SelectedScreenPointTracker
          plot={hoveredPlot}
          active={explorationMode && !isDefaultView && hoveredPlot !== null}
          orbitOverride={hoveredPlot ? mixedOrbitOverrides.get(hoveredPlot.word_id) : undefined}
          orbitTimeScale={getOrbitTimeScale(hoveredPlot)}
          onChange={onHoveredScreenPosition}
        />

        <EmotionSpaceAreas lite={explorationMode} />

        <Suspense fallback={null}>
          {selectedOrbitCenter && selectedPlot && (
            <pointLight
              position={selectedOrbitCenter}
              color={getPrimaryEmotionColor(selectedPlot.primaryId)}
              intensity={1.45}
              distance={3.2}
              decay={2}
            />
          )}
          {explorationMode && selectedPlot && !isDefaultView && !isSelectedOrbitingPlot && (
            <GravityAttractionParticles
              plot={selectedPlot}
              orbitOverride={mixedOrbitOverrides.get(selectedPlot.word_id)}
            />
          )}
          {visibleWarpGateEntries.map((entry) => (
            <WarpGate
              key={entry.key}
              plot={entry.plot}
              orbitOverride={entry.orbitOverride}
              sourceOverride={entry.sourceOverride}
              color={getPrimaryEmotionColor(entry.plot.secondaryId)}
              hoverLabel={`to${getBasicEmotion(entry.plot.secondaryId).label}空間`}
              active={entry.active && warpGateTargets.length > 0}
              onWarp={handleWarpGateSelect}
              onHoverLabelChange={onHoveredWarpGateChange}
              onHoverScreenPosition={onHoveredScreenPosition}
            />
          ))}
          {sameEmotionOrbitPlots.map((plot) => (
            <OrbitTrail
              key={`same-emotion-orbit-${plot.word_id}`}
              plot={plot}
              color={plotColorFromRow(plot)}
              isSelected
              isNearbyVisible
              particleTrail
              selectedParticleTrail={isSelectedOrbitingPlot}
              orbitTimeScale={getOrbitTimeScale(plot)}
            />
          ))}
          <ExplorationDistantPlotCloud plots={distantPlots} orbitOverrides={mixedOrbitOverrides} />
          {interactivePlots.map((plot) => (
            <WordPlot
              key={plot.word_id}
              plot={plot}
              isSelected={plot.word_id === selectedId}
              isNearbyVisible={!nearbyPlotIds || nearbyPlotIds.has(plot.word_id)}
              explorationMode={explorationMode}
              flowLabelExpiresAt={flowLabelExpiresAt}
              flowLabelNow={flowLabelNow}
              plotLabelDisplayMode={plotLabelDisplayMode}
              orbitOverride={mixedOrbitOverrides.get(plot.word_id)}
              orbitTimeScale={getOrbitTimeScale(plot)}
              onHoverChange={handleWordHover}
              onSelect={handleWordSelect}
            />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}
