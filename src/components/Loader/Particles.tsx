import { Sparkles } from '@react-three/drei';

type ParticlesProps = {
  reveal: number;
};

export function Particles({ reveal }: ParticlesProps) {
  const intensity = Math.max(0.12, reveal);

  return (
    <>
      <Sparkles
        count={Math.round(190 * intensity)}
        size={2.9}
        speed={0.26 + reveal * 0.42}
        opacity={0.2 + reveal * 0.5}
        scale={[13, 6, 8]}
        color="#93c5fd"
      />
      <Sparkles
        count={Math.round(80 * intensity)}
        size={3.8}
        speed={0.18 + reveal * 0.3}
        opacity={0.16 + reveal * 0.4}
        scale={[18, 9, 10]}
        color="#5eead4"
      />
      <Sparkles
        count={Math.round(60 * intensity)}
        size={3.2}
        speed={0.16 + reveal * 0.25}
        opacity={0.08 + reveal * 0.26}
        scale={[16, 8, 12]}
        color="#f9a8d4"
      />
    </>
  );
}
