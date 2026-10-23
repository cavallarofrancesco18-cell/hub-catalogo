import { Canvas } from '@react-three/fiber';
import { CameraRig } from './CameraRig';
import { Car } from './Car';
import { Lights } from './Lights';
import { Particles } from './Particles';

type SceneProps = {
  phase: number;
  reveal: number;
  headlights: number;
  finalBurst: number;
  onModelReady: () => void;
};

export function Scene({ phase, reveal, headlights, finalBurst, onModelReady }: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.8, 6.5], fov: 35, near: 0.1, far: 120 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ background: '#070c1c', width: '100%', height: '100%', display: 'block' }}
    >
      <color attach="background" args={['#050814']} />
      <fog attach="fog" args={['#0a1020', 6.8, 28]} />

      <CameraRig phase={phase} reveal={reveal} finalBurst={finalBurst} />
      <Lights phase={phase} headlights={headlights} reveal={reveal} />
      <Car reveal={reveal} phase={phase} finalBurst={finalBurst} onReady={onModelReady} />
      <Particles reveal={reveal} />
    </Canvas>
  );
}
