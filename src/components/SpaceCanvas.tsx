import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { UserPlotRow } from '../types/userPlot';
import { WordPlot } from './WordPlot';

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 5, 8];
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];
const DEFAULT_CAMERA_FOV = 60;

interface SpaceCanvasProps {
  plots: UserPlotRow[];
  currentMode: 'emotion' | 'state';
  selectedId: string | null;
  onWordSelect: (id: string) => void;
}

function CameraControls({ resetCount }: { resetCount: number }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (resetCount === 0) return;

    camera.position.set(...DEFAULT_CAMERA_POSITION);
    if ('fov' in camera) {
      camera.fov = DEFAULT_CAMERA_FOV;
      camera.updateProjectionMatrix();
    }

    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(...DEFAULT_CAMERA_TARGET);
      controls.update();
    }
  }, [resetCount, camera]);

  return <OrbitControls ref={controlsRef} enableDamping />;
}

export function SpaceCanvas({ plots, currentMode, selectedId, onWordSelect }: SpaceCanvasProps) {
  const [resetCount, setResetCount] = useState(0);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#0b0c10', position: 'relative' }}>
      <button
        type="button"
        onClick={() => setResetCount((count) => count + 1)}
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

        <CameraControls resetCount={resetCount} />

        <Suspense fallback={null}>
          {plots.map((plot) => (
            <WordPlot
              key={plot.word_id}
              plot={plot}
              currentMode={currentMode}
              isSelected={plot.word_id === selectedId}
              onSelect={onWordSelect}
            />
          ))}
        </Suspense>

        <Grid
          position={[0, 0, 0]}
          args={[15, 15]}
          cellSize={1}
          cellColor="#2a3542"
          sectionSize={5}
          sectionColor="#45f3ff"
          fadeDistance={30}
        />
      </Canvas>
    </div>
  );
}
