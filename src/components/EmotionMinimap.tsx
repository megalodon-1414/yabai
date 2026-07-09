import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BASIC_EMOTIONS } from '../data/emotions';
import type { AppBackgroundTheme } from '../utils/appBackgroundTheme';
import { getBackgroundThemeColors } from '../utils/appBackgroundTheme';
import {
  MINIMAP_DEFAULT_CAMERA,
  MINIMAP_SHAPE_CENTER,
  buildMinimapWireframePositions,
  getBasicEmotionMinimapVertices,
  getMinimapBoundingRadius,
  worldTupleToMinimapLocal,
  type MinimapSyncState,
} from '../utils/emotionMinimapLayout';

const SIZE = 176;
const FIT_MARGIN = 1.14;

interface EmotionMinimapProps {
  syncState: MinimapSyncState | null;
  backgroundTheme: AppBackgroundTheme;
}

function computeFitDistance(camera: THREE.PerspectiveCamera, boundingRadius: number): number {
  const fovRad = (camera.fov * Math.PI) / 180;
  const halfFov = fovRad / 2;
  const verticalDistance = boundingRadius / Math.sin(halfFov);
  const horizontalDistance = boundingRadius / (Math.sin(halfFov) * camera.aspect);
  return Math.max(verticalDistance, horizontalDistance) * FIT_MARGIN;
}

function MinimapCamera({ syncState }: { syncState: MinimapSyncState | null }) {
  const { camera } = useThree();
  const shapeCenter = useRef(new THREE.Vector3(...MINIMAP_SHAPE_CENTER));
  const desiredPosition = useRef(new THREE.Vector3(...MINIMAP_DEFAULT_CAMERA));
  const desiredUp = useRef(new THREE.Vector3(0, 1, 0));
  const boundingRadius = useMemo(() => getMinimapBoundingRadius(), []);

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }

    const fitDistance = computeFitDistance(camera, boundingRadius);

    if (syncState) {
      const camPos = new THREE.Vector3(...worldTupleToMinimapLocal(syncState.cameraPosition));
      const camTarget = new THREE.Vector3(...worldTupleToMinimapLocal(syncState.cameraTarget));
      const viewDir = camPos.sub(camTarget);
      if (viewDir.lengthSq() > 1e-6) {
        desiredPosition.current.copy(shapeCenter.current).add(viewDir.normalize().multiplyScalar(fitDistance));
      } else {
        desiredPosition.current.set(...MINIMAP_DEFAULT_CAMERA).normalize().multiplyScalar(fitDistance);
      }
      desiredUp.current.set(...syncState.cameraUp).normalize();
    } else {
      desiredPosition.current
        .set(...MINIMAP_DEFAULT_CAMERA)
        .normalize()
        .multiplyScalar(fitDistance);
      desiredUp.current.set(0, 1, 0);
    }

    camera.position.lerp(desiredPosition.current, 0.22);
    camera.up.copy(desiredUp.current);
    camera.lookAt(shapeCenter.current);
  });

  return null;
}

function MinimapWireframe({ wireColor }: { wireColor: string }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(buildMinimapWireframePositions(), 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={wireColor} transparent opacity={0.72} />
    </lineSegments>
  );
}

function MinimapEmotionNodes() {
  const vertices = useMemo(() => getBasicEmotionMinimapVertices(), []);

  return (
    <>
      {BASIC_EMOTIONS.map((emotion) => {
        const [x, y, z] = vertices[emotion.id];
        return (
          <mesh key={emotion.id} position={[x, y, z]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshBasicMaterial color={emotion.color} />
          </mesh>
        );
      })}
    </>
  );
}

function MinimapFocusMarker({ syncState }: { syncState: MinimapSyncState | null }) {
  const markerRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!markerRef.current) {
      return;
    }

    if (!syncState?.focusPosition) {
      markerRef.current.visible = false;
      return;
    }

    markerRef.current.visible = true;
    markerRef.current.position.set(...worldTupleToMinimapLocal(syncState.focusPosition));

    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.08);
    }
  });

  return (
    <group ref={markerRef} visible={false}>
      <mesh ref={ringRef}>
        <sphereGeometry args={[0.09, 14, 14]} />
        <meshBasicMaterial color="#45f3ff" transparent opacity={0.28} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#45f3ff" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function MinimapViewRay({ syncState }: { syncState: MinimapSyncState | null }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({ color: '#45f3ff', transparent: true, opacity: 0.9 });
    const object = new THREE.Line(geometry, material);
    object.visible = false;
    return object;
  }, []);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  useFrame(() => {
    if (!syncState?.focusPosition) {
      line.visible = false;
      return;
    }

    const focus = new THREE.Vector3(...worldTupleToMinimapLocal(syncState.focusPosition));
    const camPos = new THREE.Vector3(...worldTupleToMinimapLocal(syncState.cameraPosition));
    const camTarget = new THREE.Vector3(...worldTupleToMinimapLocal(syncState.cameraTarget));
    const dir = camPos.sub(camTarget);

    if (dir.lengthSq() < 1e-6) {
      line.visible = false;
      return;
    }

    const tip = focus.clone().add(dir.normalize().multiplyScalar(0.28));
    const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.setXYZ(0, focus.x, focus.y, focus.z);
    attr.setXYZ(1, tip.x, tip.y, tip.z);
    attr.needsUpdate = true;
    line.visible = true;
  });

  return <primitive object={line} />;
}

function MinimapScene({
  syncState,
  wireColor,
  canvasClear,
}: {
  syncState: MinimapSyncState | null;
  wireColor: string;
  canvasClear: string;
}) {
  return (
    <>
      <color attach="background" args={[canvasClear]} />
      <MinimapCamera syncState={syncState} />
      <ambientLight intensity={0.85} />
      <MinimapWireframe wireColor={wireColor} />
      <MinimapEmotionNodes />
      <MinimapFocusMarker syncState={syncState} />
      <MinimapViewRay syncState={syncState} />
    </>
  );
}

export function EmotionMinimap({ syncState, backgroundTheme }: EmotionMinimapProps) {
  const theme = getBackgroundThemeColors(backgroundTheme);
  const wireColor = backgroundTheme === 'dark' ? '#f4ecf7' : '#2a2a34';
  const canvasClear = backgroundTheme === 'dark' ? 'rgba(8, 7, 12, 0.95)' : 'rgba(240, 240, 244, 0.95)';

  return (
    <div
      aria-label="感情空間ミニマップ"
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 2,
        width: `${SIZE}px`,
        padding: '10px',
        border: `1px solid ${theme.controlBorder}`,
        borderRadius: '12px',
        backgroundColor: theme.controlBackground,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.22)',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <p
        style={{
          margin: '0 0 6px',
          fontSize: '0.62rem',
          letterSpacing: '0.14em',
          color: theme.controlText,
          opacity: 0.72,
          textAlign: 'center',
        }}
      >
        MAP
      </p>
      <div style={{ width: `${SIZE - 20}px`, height: `${SIZE - 20}px`, borderRadius: '8px', overflow: 'hidden' }}>
        <Canvas
          camera={{ position: MINIMAP_DEFAULT_CAMERA, fov: 36, near: 0.05, far: 20 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: false }}
          style={{ width: '100%', height: '100%' }}
        >
          <MinimapScene syncState={syncState} wireColor={wireColor} canvasClear={canvasClear} />
        </Canvas>
      </div>
    </div>
  );
}
