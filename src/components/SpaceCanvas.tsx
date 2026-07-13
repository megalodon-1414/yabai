import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getEmotionById } from '../data/emotions';
import type { UserPlotRow } from '../types/userPlot';
import {
  createMixedPlotOrbitOverrides,
  getNearbyPlotIds,
  isPureEmotionPlot,
  plotColorFromRow,
  plotPositionFromRow,
  type PlotOrbitOverride,
} from '../utils/plotFromUserPlot';
import { getMixedDirectionPositionAtIntensity } from '../utils/emotionPlotPosition';
import type { EmotionUiTheme } from '../utils/emotionUiTheme';
import { getBackgroundThemeColors, type AppBackgroundTheme } from '../utils/appBackgroundTheme';
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
import { findLinkedWarpDestination } from '../utils/warpGateLink';
import {
  MAX_MOVABLE_NEARBY_STARS,
  WARP_GATE_ANCHOR_INTENSITY,
  canEnterWarpGate,
} from '../utils/warpGateRules';
import { findPlotByKey, getPlotKey } from '../utils/plotIdentity';
import type { MinimapSyncState } from '../utils/emotionMinimapLayout';
import { EmotionDirectionArrows } from './EmotionDirectionArrows';
import { EmotionSpaceAreas } from './EmotionSpaceAreas';
import { ExplorationDistantPlotCloud } from './ExplorationDistantPlotCloud';
import { GravityAttractionParticles } from './GravityAttractionParticles';
import { OrbitTrail } from './OrbitTrail';
import { WarpGate } from './WarpGate';
import { WordPlot } from './WordPlot';

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 3, 18];
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];
const DEFAULT_CAMERA_FOV = 78;
const SELECTION_CAMERA_DISTANCE = 5;
const DEFAULT_CAMERA_DISTANCE = new THREE.Vector3(...DEFAULT_CAMERA_POSITION).distanceTo(
  new THREE.Vector3(...DEFAULT_CAMERA_TARGET),
);
const TARGET_LERP_SPEED = 6;
const TARGET_ARRIVAL_THRESHOLD = 0.2;
const ROTATION_SPEED = 0.006;
const WHEEL_ZOOM_SPEED = 0.0015;
const SELECTED_ORBIT_TIME_SCALE = 0.18;

type FocusPhase = 'idle' | 'movingTarget' | 'movingView' | 'adjustingZoom' | 'focused';

interface WarpGateEntry {
  key: string;
  plot: UserPlotRow;
  orbitOverride?: PlotOrbitOverride;
  sourceOverride?: [number, number, number];
  anchorAtSource?: boolean;
  active: boolean;
}

interface SpaceCanvasProps {
  plots: UserPlotRow[];
  /** ワープ着地の探索用（タグ未フィルタの全プロット）。省略時は plots */
  warpDestinationPlots?: UserPlotRow[];
  selectedId: string | null;
  explorationMode?: boolean;
  flowLabelExpiresAt?: Readonly<Record<string, number>>;
  flowLabelNow?: number;
  plotLabelDisplayMode?: PlotLabelDisplayMode;
  backgroundTheme?: AppBackgroundTheme;
  emotionUiTheme?: EmotionUiTheme;
  onSelectedScreenPosition?: (point: { x: number; y: number; visible: boolean } | null) => void;
  onHoveredWordChange?: (wordId: string | null) => void;
  onHoveredWarpGateChange?: (label: string | null) => void;
  onHoveredScreenPosition?: (point: { x: number; y: number; visible: boolean } | null) => void;
  onMinimapSync?: (state: MinimapSyncState | null) => void;
  onWordSelect: (id: string, options?: { viaWarp?: boolean }) => void;
}

interface CameraViewAlignRequest {
  direction: [number, number, number];
  nonce: number;
}

interface CameraControlsProps {
  resetCount: number;
  cameraTarget: [number, number, number];
  focusOnSelection: boolean;
  explorationFocus?: boolean;
  explorationAnchor?: { x: number; y: number };
  explorationDistance?: number;
  /** 指定時は毎フレームこのプロット位置を注視点にする（公転する純感情用） */
  followPlot?: UserPlotRow | null;
  followOrbitOverride?: PlotOrbitOverride;
  followOrbitTimeScale?: number;
  /** 感情方向クリック時、カメラをその向きへ回す */
  viewAlignRequest?: CameraViewAlignRequest | null;
  interactionLockRef?: MutableRefObject<boolean>;
  onCameraStateChange?: (state: Pick<MinimapSyncState, 'cameraPosition' | 'cameraTarget' | 'cameraUp'>) => void;
}

const VIEW_ALIGN_SPEED = 4.2;
/** 正面揃えだと単語が重なるので、少し上からのアングルにする */
const VIEW_ALIGN_ELEVATION = 0.3;
/** 矢印方向が画面左上に見えるよう、カメラを右下寄りにずらす */
const VIEW_ALIGN_LATERAL = 0.6;
/** 大きいほど感情方向の奥を向く */
const VIEW_ALIGN_BACK = 0.7;

function CameraControls({
  resetCount,
  cameraTarget,
  focusOnSelection,
  explorationFocus = false,
  explorationAnchor = EXPLORATION_SCREEN_ANCHOR,
  explorationDistance = EXPLORATION_CAMERA_DISTANCE,
  followPlot = null,
  followOrbitOverride,
  followOrbitTimeScale = 1,
  viewAlignRequest = null,
  interactionLockRef,
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
  const alignFrom = useRef(new THREE.Vector3());
  const alignTo = useRef(new THREE.Vector3());
  const alignDir = useRef(new THREE.Vector3());
  const alignProgress = useRef(1);
  const lastAlignNonce = useRef<number | null>(null);
  const worldUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const alignLateral = useRef(new THREE.Vector3());
  const alignScreen = useRef(new THREE.Vector3());
  const alignViewForward = useRef(new THREE.Vector3());

  const focusDistance = explorationFocus ? explorationDistance : SELECTION_CAMERA_DISTANCE;
  const screenAnchor = explorationFocus ? explorationAnchor : undefined;
  const enableRotate = !focusOnSelection || explorationFocus;
  const enableZoom = !focusOnSelection;

  const setFocusPhase = (phase: FocusPhase) => {
    focusPhase.current = phase;
  };

  useEffect(() => {
    if (!viewAlignRequest || viewAlignRequest.nonce === lastAlignNonce.current) {
      return;
    }
    lastAlignNonce.current = viewAlignRequest.nonce;
    alignFrom.current.copy(camera.position).sub(smoothTarget.current);
    if (alignFrom.current.lengthSq() < 0.0001) {
      alignFrom.current.set(...DEFAULT_CAMERA_POSITION).sub(smoothTarget.current);
    }
    alignFrom.current.normalize();

    alignDir.current
      .set(viewAlignRequest.direction[0], viewAlignRequest.direction[1], viewAlignRequest.direction[2])
      .normalize();
    // 感情方向が画面左上に見えるよう、カメラを右下＋やや上に置く
    alignLateral.current.crossVectors(worldUp, alignDir.current);
    if (alignLateral.current.lengthSq() < 1e-8) {
      alignLateral.current.set(1, 0, 0);
    } else {
      alignLateral.current.normalize();
    }
    alignTo.current
      .copy(alignDir.current)
      .multiplyScalar(-VIEW_ALIGN_BACK)
      .addScaledVector(worldUp, VIEW_ALIGN_ELEVATION)
      .addScaledVector(alignLateral.current, VIEW_ALIGN_LATERAL);
    if (alignTo.current.lengthSq() < 0.0001) {
      return;
    }
    alignTo.current.normalize();
    alignProgress.current = 0;
  }, [camera, viewAlignRequest, worldUp]);

  useEffect(() => {
    baseTarget.current.set(...cameraTarget);

    if (!focusOnSelection) {
      setFocusPhase('idle');
      viewOffsetProgress.current = 0;
      zoomProgress.current = 0;

      if (camera instanceof THREE.PerspectiveCamera) {
        clearSelectionViewOffset(camera);
      }
    } else if (prevFocusOnSelection.current) {
      // 選択中の別単語切替: アングル（オフセット方向）は維持し、注視点だけ更新
      if (focusPhase.current !== 'focused' && focusPhase.current !== 'idle') {
        viewOffsetProgress.current = 1;
        zoomProgress.current = 1;
        setFocusPhase('focused');
        if (camera instanceof THREE.PerspectiveCamera) {
          applySelectionViewOffset(camera, size.width, size.height, 1, screenAnchor);
        }
      }
    } else {
      // 非選択 → 選択: 3段階シーケンスを最初から
      cameraOffsetDirection.current.copy(camera.position).sub(smoothTarget.current);
      setFocusPhase('movingTarget');
      viewOffsetProgress.current = 0;
      zoomProgress.current = 0;

      if (camera instanceof THREE.PerspectiveCamera) {
        clearSelectionViewOffset(camera);
      }
    }

    prevFocusOnSelection.current = focusOnSelection;
  }, [cameraTarget, focusOnSelection, explorationAnchor, camera, screenAnchor, size.height, size.width]);

  /** オフセット方向は維持したまま距離だけ合わせる（選択切替でアングルを保つ） */
  const applyCameraDistance = (distance: number, target: THREE.Vector3) => {
    if (cameraOffsetDirection.current.lengthSq() < 0.0001) {
      cameraOffsetDirection.current.copy(camera.position).sub(target);
    }
    if (cameraOffsetDirection.current.lengthSq() < 0.0001) {
      cameraOffsetDirection.current.set(...DEFAULT_CAMERA_POSITION).sub(target);
    }
    cameraOffsetDirection.current.normalize().multiplyScalar(distance);
    camera.position.copy(target).add(cameraOffsetDirection.current);
  };

  const rotateCameraAroundTarget = (deltaX: number, deltaY: number) => {
    const target = smoothTarget.current;
    if (cameraOffsetDirection.current.lengthSq() < 0.0001) {
      cameraOffsetDirection.current.copy(camera.position).sub(target);
    }
    if (cameraOffsetDirection.current.lengthSq() < 0.0001) return;

    cameraRight.current.setFromMatrixColumn(camera.matrix, 0).normalize();

    rotationQuaternion.current.setFromAxisAngle(camera.up, -deltaX * ROTATION_SPEED);
    cameraOffsetDirection.current.applyQuaternion(rotationQuaternion.current);
    camera.up.applyQuaternion(rotationQuaternion.current).normalize();

    rotationAxis.current.copy(cameraRight.current).normalize();
    rotationQuaternion.current.setFromAxisAngle(rotationAxis.current, -deltaY * ROTATION_SPEED);
    cameraOffsetDirection.current.applyQuaternion(rotationQuaternion.current);
    camera.up.applyQuaternion(rotationQuaternion.current).normalize();

    camera.position.copy(target).add(cameraOffsetDirection.current);
    camera.lookAt(target);
  };

  useEffect(() => {
    const element = gl.domElement;

    const handlePointerDown = (event: PointerEvent) => {
      if (!enableRotate || event.button !== 0) return;
      if (interactionLockRef?.current) return;
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
      if (cameraOffsetDirection.current.lengthSq() < 0.0001) {
        cameraOffsetDirection.current.copy(camera.position).sub(target);
      }
      const scale = Math.exp(event.deltaY * WHEEL_ZOOM_SPEED);
      const distance = THREE.MathUtils.clamp(
        cameraOffsetDirection.current.length() * scale,
        0.1,
        1000,
      );
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
  }, [camera, gl, enableRotate, enableZoom, interactionLockRef]);

  useFrame((state, delta) => {
    if (followPlot) {
      baseTarget.current.set(
        ...plotPositionFromRow(
          followPlot,
          state.clock.elapsedTime * followOrbitTimeScale,
          followOrbitOverride,
        ),
      );
    }

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

    const focusOrZooming =
      focusOnSelection
      && (focusPhase.current === 'focused' || focusPhase.current === 'adjustingZoom');

    if (alignProgress.current < 1) {
      alignProgress.current = Math.min(1, alignProgress.current + delta * VIEW_ALIGN_SPEED);
      const t = alignProgress.current * alignProgress.current * (3 - 2 * alignProgress.current);
      cameraOffsetDirection.current
        .copy(alignFrom.current)
        .lerp(alignTo.current, t)
        .normalize()
        .multiplyScalar(focusDistance);
      camera.position.copy(smoothTarget.current).add(cameraOffsetDirection.current);
      camera.up.copy(worldUp);
      camera.lookAt(smoothTarget.current);

      // 視線まわりにロールし、感情方向の画面上の向きを左上に合わせる
      alignViewForward.current.copy(smoothTarget.current).sub(camera.position).normalize();
      alignScreen.current
        .copy(alignDir.current)
        .addScaledVector(alignViewForward.current, -alignDir.current.dot(alignViewForward.current));
      if (alignScreen.current.lengthSq() > 1e-8) {
        alignScreen.current.normalize();
        cameraRight.current.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        const camUp = rotationAxis.current.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
        const currentAngle = Math.atan2(
          alignScreen.current.dot(camUp),
          alignScreen.current.dot(cameraRight.current),
        );
        const desiredAngle = Math.atan2(1, -1); // 画面左上
        const roll = desiredAngle - currentAngle;
        camera.up.copy(camUp).applyAxisAngle(alignViewForward.current, roll).normalize();
        camera.lookAt(smoothTarget.current);
        cameraOffsetDirection.current.copy(camera.position).sub(smoothTarget.current);
      }
    } else if (focusOrZooming) {
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
      primaryLabel: plot.primaryLabel ?? null,
    });
  });

  return null;
}

export function SpaceCanvas({
  plots,
  warpDestinationPlots,
  selectedId,
  explorationMode = false,
  flowLabelExpiresAt,
  flowLabelNow = 0,
  plotLabelDisplayMode = 'flow',
  backgroundTheme = 'dark',
  emotionUiTheme,
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
  const [viewAlignRequest, setViewAlignRequest] = useState<CameraViewAlignRequest | null>(null);
  const cameraInteractionLockRef = useRef(false);
  const selectedPlot = useMemo(
    () => findPlotByKey(plots, selectedId),
    [plots, selectedId],
  );
  const hoveredPlot = useMemo(
    () => findPlotByKey(plots, hoveredId),
    [plots, hoveredId],
  );
  const mixedOrbitOverrides = useMemo(() => createMixedPlotOrbitOverrides(plots), [plots]);
  const selectedMixedOrbit = selectedPlot ? mixedOrbitOverrides.get(selectedPlot.word_id) : undefined;
  const isSelectedPureOrbiting = explorationMode && selectedPlot ? isPureEmotionPlot(selectedPlot) : false;
  /** 純感情の公転、または同意義の混合回転グループ */
  const isSelectedOrbitingPlot = isSelectedPureOrbiting || Boolean(explorationMode && selectedMixedOrbit);
  const selectedOrbitCenter = useMemo((): [number, number, number] | null => {
    if (!isSelectedPureOrbiting || !selectedPlot) {
      return null;
    }

    const center = getEmotionCenter(selectedPlot.primaryId);
    return [center.x, center.y, center.z];
  }, [isSelectedPureOrbiting, selectedPlot?.primaryId]);

  const cameraTarget = useMemo((): [number, number, number] => {
    if (isDefaultView || !selectedId) {
      return DEFAULT_CAMERA_TARGET;
    }

    if (!selectedPlot) {
      return DEFAULT_CAMERA_TARGET;
    }

    // 公転・同意義回転中も単語自体を中心にする（followPlot が毎フレーム追従）
    return plotPositionFromRow(selectedPlot, 0, selectedMixedOrbit);
  }, [isDefaultView, selectedId, selectedPlot, selectedMixedOrbit]);

  const nearbyPlotIds = useMemo(() => {
    if (!selectedId || isDefaultView) {
      return null;
    }

    if (explorationMode) {
      return getNearbyPlotIds(plots, selectedId, EXPLORATION_NEARBY_RADIUS, mixedOrbitOverrides, {
        sameEmotionSystemOnly: true,
        maxMovable: MAX_MOVABLE_NEARBY_STARS,
      });
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

    return plots.filter((plot) => getPlotKey(plot) === selectedId || nearbyPlotIds.has(getPlotKey(plot)));
  }, [explorationMode, nearbyPlotIds, plots, selectedId]);

  const distantSameSystemPlots = useMemo(() => {
    if (!explorationMode || !nearbyPlotIds || !selectedPlot) {
      return [];
    }

    return plots.filter(
      (plot) =>
        getPlotKey(plot) !== selectedId
        && plot.primaryId === selectedPlot.primaryId
        && !nearbyPlotIds.has(getPlotKey(plot)),
    );
  }, [explorationMode, nearbyPlotIds, plots, selectedId, selectedPlot]);

  const distantOtherSystemPlots = useMemo(() => {
    if (!explorationMode || !nearbyPlotIds || !selectedPlot) {
      return [];
    }

    return plots.filter(
      (plot) =>
        getPlotKey(plot) !== selectedId
        && plot.primaryId !== selectedPlot.primaryId
        && !nearbyPlotIds.has(getPlotKey(plot)),
    );
  }, [explorationMode, nearbyPlotIds, plots, selectedId, selectedPlot]);

  const isExplorationFocused = explorationMode && !isDefaultView && selectedId !== null;

  const warpGatePlots = useMemo(() => {
    if (!explorationMode || isDefaultView || !selectedPlot) {
      return [];
    }

    const selectedParams = rowToEmotionParams(selectedPlot);
    // 副感情が一致する混合感情のときだけゲートを出す
    if (selectedParams.isPure || selectedParams.secondaryId === selectedParams.primaryId) {
      return [];
    }

    return [selectedPlot];
  }, [explorationMode, isDefaultView, selectedPlot]);

  const selectedWarpGatePlot = useMemo(() => {
    if (!selectedPlot || warpGatePlots.length === 0) {
      return null;
    }

    return selectedPlot;
  }, [selectedPlot, warpGatePlots]);

  const canEnterSelectedWarpGate = useMemo(() => {
    if (!selectedPlot || !selectedWarpGatePlot) {
      return false;
    }
    // 強度35以上なら進入可（極限語に限らない）
    return canEnterWarpGate(selectedPlot);
  }, [selectedPlot, selectedWarpGatePlot]);

  const warpGateTargets = useMemo(() => {
    if (!selectedWarpGatePlot || !selectedPlot || !canEnterSelectedWarpGate) {
      return [];
    }

    const params = rowToEmotionParams(selectedWarpGatePlot);
    const fromEmotionId = selectedPlot.primaryId;
    const toEmotionId = params.secondaryId;
    if (toEmotionId === fromEmotionId) {
      return [];
    }

    // 行き先空間の純感情（循環上）へ着地（タグフィルタ前の全プロットから探す）
    const linked = findLinkedWarpDestination(
      warpDestinationPlots ?? plots,
      fromEmotionId,
      toEmotionId,
      {
        excludeWordId: selectedId,
      },
    );
    return linked ? [linked] : [];
  }, [
    canEnterSelectedWarpGate,
    plots,
    selectedId,
    selectedPlot,
    selectedWarpGatePlot,
    warpDestinationPlots,
  ]);

  const visibleWarpGateEntries = useMemo((): WarpGateEntry[] => {
    if (!selectedWarpGatePlot || !selectedPlot) {
      return [];
    }

    const params = rowToEmotionParams(selectedWarpGatePlot);
    if (params.secondaryId === selectedPlot.primaryId) {
      return [];
    }

    const anchor = getMixedDirectionPositionAtIntensity(
      selectedPlot.primaryId,
      params.secondaryId,
      WARP_GATE_ANCHOR_INTENSITY,
    );

    return [{
      key: `warp-gate-${selectedPlot.primaryId}-to-${params.secondaryId}`,
      plot: selectedWarpGatePlot,
      sourceOverride: anchor,
      anchorAtSource: true,
      // 同じ副感情内で最強度の語を選んでいるときだけ進入可
      active: canEnterSelectedWarpGate,
    }];
  }, [canEnterSelectedWarpGate, selectedPlot, selectedWarpGatePlot]);

  const handleWarpGateSelect = useCallback(() => {
    const target = warpGateTargets[0];
    if (!target) {
      return;
    }

    setIsDefaultView(false);
    onWordSelect(getPlotKey(target), { viaWarp: true });
  }, [onWordSelect, warpGateTargets]);

  const getOrbitTimeScale = useCallback((plot: UserPlotRow | null | undefined): number => (
    isSelectedPureOrbiting && selectedPlot && plot && isPureEmotionPlot(plot) && plot.primaryId === selectedPlot.primaryId
      ? SELECTED_ORBIT_TIME_SCALE
      : 1
  ), [isSelectedPureOrbiting, selectedPlot]);

  const handleWordSelect = useCallback((id: string) => {
    setIsDefaultView(false);
    onWordSelect(id);
  }, [onWordSelect]);

  const handleWordHover = useCallback((id: string | null) => {
    setHoveredId(id);
    onHoveredWordChange?.(id);
  }, [onHoveredWordChange]);

  const handleLookDirection = useCallback((direction: [number, number, number]) => {
    setViewAlignRequest({ direction, nonce: Date.now() });
  }, []);

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
  const canvasBackground = emotionUiTheme?.canvas ?? backgroundColors.canvas;

  useEffect(() => {
    setAtmosphereFogColor(canvasBackground);
  }, [canvasBackground]);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: canvasBackground, position: 'relative', transition: 'background-color 320ms ease' }}>
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
          explorationDistance={EXPLORATION_CAMERA_DISTANCE}
          followPlot={isSelectedOrbitingPlot ? selectedPlot : null}
          followOrbitOverride={selectedMixedOrbit}
          followOrbitTimeScale={getOrbitTimeScale(selectedPlot)}
          viewAlignRequest={viewAlignRequest}
          interactionLockRef={cameraInteractionLockRef}
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
          {explorationMode && selectedPlot && !isDefaultView && !isSelectedPureOrbiting && (
            <GravityAttractionParticles
              plot={selectedPlot}
              orbitOverride={mixedOrbitOverrides.get(selectedPlot.word_id)}
              guideStars={interactivePlots
                .filter((candidate) => candidate.word_id !== selectedPlot.word_id)
                .map((candidate) =>
                  plotPositionFromRow(candidate, 0, mixedOrbitOverrides.get(candidate.word_id)),
                )}
            />
          )}
          {explorationMode && selectedPlot && !isDefaultView && (
            <EmotionDirectionArrows
              plot={selectedPlot}
              plots={plots}
              orbitOverride={mixedOrbitOverrides.get(selectedPlot.word_id)}
              orbitTimeScale={getOrbitTimeScale(selectedPlot)}
              onLookDirection={handleLookDirection}
              interactionLockRef={cameraInteractionLockRef}
            />
          )}
          {visibleWarpGateEntries.map((entry) => (
            <WarpGate
              key={entry.key}
              targetEmotionId={entry.plot.secondaryId}
              plot={entry.plot}
              orbitOverride={entry.orbitOverride}
              sourceOverride={entry.sourceOverride}
              anchorAtSource={entry.anchorAtSource}
              approachHitPlot={selectedPlot}
              approachHitOrbitOverride={selectedPlot ? mixedOrbitOverrides.get(selectedPlot.word_id) : undefined}
              color={getPrimaryEmotionColor(entry.plot.secondaryId)}
              hoverLabel={`to${getEmotionById(entry.plot.secondaryId).label}空間`}
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
              selectedParticleTrail={isSelectedPureOrbiting}
              orbitTimeScale={getOrbitTimeScale(plot)}
            />
          ))}
          <ExplorationDistantPlotCloud
            sameSystemPlots={distantSameSystemPlots}
            otherSystemPlots={distantOtherSystemPlots}
            orbitOverrides={mixedOrbitOverrides}
          />
          {interactivePlots.map((plot) => (
            <WordPlot
              key={getPlotKey(plot)}
              plot={plot}
              isSelected={getPlotKey(plot) === selectedId}
              isNearbyVisible={!nearbyPlotIds || nearbyPlotIds.has(getPlotKey(plot))}
              explorationMode={explorationMode}
              flowLabelExpiresAt={flowLabelExpiresAt}
              flowLabelNow={flowLabelNow}
              plotLabelDisplayMode={plotLabelDisplayMode}
              orbitOverride={mixedOrbitOverrides.get(plot.word_id)}
              orbitTimeScale={getOrbitTimeScale(plot)}
              suppressPointerHit={
                getPlotKey(plot) === selectedId
                && warpGateTargets.length > 0
                && canEnterSelectedWarpGate
              }
              onHoverChange={handleWordHover}
              onSelect={handleWordSelect}
            />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}
