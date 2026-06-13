import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { WordData } from '../types/word';
import { WordPlot } from './WordPlot';

interface SpaceCanvasProps {
  words: WordData[];
  currentMode: 'emotion' | 'state';
}

export function SpaceCanvas({ words, currentMode }: SpaceCanvasProps) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#0b0c10' }}>
      <Canvas camera={{ position: [0, 5, 8], fov: 60 }} style={{ width: '100%', height: '100%' }}>
        <color attach="background" args={['#0b0c10']} />
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} />

        <OrbitControls enableDamping />

        <Suspense fallback={null}>
          {words.map((word) => (
            <WordPlot key={word.id} word={word} currentMode={currentMode} />
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
