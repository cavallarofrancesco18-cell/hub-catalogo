import { useMemo } from 'react';
import * as THREE from 'three';

type LightsProps = {
  phase: number;
  headlights: number;
  reveal: number;
};

export function Lights({ phase, headlights, reveal }: LightsProps) {
  const headlightIntensity = useMemo(() => {
    const visibility = phase >= 2 ? headlights : 0;
    return THREE.MathUtils.lerp(0, 7.2, visibility);
  }, [phase, headlights]);

  const fillIntensity = useMemo(() => THREE.MathUtils.lerp(0.06, 1.35, reveal), [reveal]);

  return (
    <>
      <ambientLight intensity={0.03 + reveal * 0.1} />
      <hemisphereLight color="#7dd3fc" groundColor="#1e1b4b" intensity={fillIntensity * 0.72} />

      <directionalLight
        castShadow
        position={[3.8, 5.5, 2.3]}
        intensity={fillIntensity * 1.1}
        color="#c4b5fd"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-radius={8}
        shadow-bias={-0.00008}
      />

      <spotLight
        position={[2.4, 0.46, 1.05]}
        target-position={[8.4, 0.25, 0.55]}
        angle={0.28}
        penumbra={0.84}
        distance={20}
        intensity={headlightIntensity}
        color="#fef3c7"
      />
      <spotLight
        position={[2.4, 0.46, -1.05]}
        target-position={[8.4, 0.25, -0.55]}
        angle={0.28}
        penumbra={0.84}
        distance={20}
        intensity={headlightIntensity}
        color="#fef9c3"
      />

      <pointLight
        position={[-2.5, 1.4, 0]}
        intensity={0.65 + reveal * 0.95}
        distance={16}
        color="#22d3ee"
      />

      <pointLight position={[1.6, 1.2, 2.2]} intensity={0.45 + reveal * 0.85} distance={18} color="#f472b6" />
      <pointLight position={[-1.8, 0.9, -2.4]} intensity={0.4 + reveal * 0.8} distance={16} color="#34d399" />

      <mesh position={[3.2, 0.4, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[1.7, 8, 32, 1, true]} />
        <meshBasicMaterial
          color="#f8fafc"
          transparent
          opacity={0.08 + headlights * 0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
