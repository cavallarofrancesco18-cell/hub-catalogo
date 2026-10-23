import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

type CameraRigProps = {
  phase: number;
  reveal: number;
  finalBurst: number;
};

export function CameraRig({ phase, reveal, finalBurst }: CameraRigProps) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0.45, 0));

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    let desiredZ = 6.5;
    if (phase >= 3) {
      desiredZ = THREE.MathUtils.lerp(6.5, 3.7, reveal);
    }
    if (phase === 6) {
      desiredZ = THREE.MathUtils.lerp(desiredZ, 1.08, finalBurst);
    }

    const desiredX = Math.sin(t * 0.28) * 0.26;
    const desiredY = 0.84 + Math.sin(t * 0.16) * 0.07;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredX, 2.4, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredY, 2.4, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredZ, phase === 6 ? 6 : 2.2, delta);

    target.current.x = Math.sin(t * 0.2) * 0.08;
    target.current.y = 0.45 + Math.sin(t * 0.4) * 0.04;
    camera.lookAt(target.current);
  });

  return null;
}
