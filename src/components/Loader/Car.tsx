import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Image as DreiImage, MeshReflectorMaterial, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group, Object3D } from 'three';
import * as THREE from 'three';

type CarProps = {
  reveal: number;
  phase: number;
  finalBurst: number;
  onReady: () => void;
  modelPath?: string;
};

const SHOWROOM_IMAGE_URLS = [
  'https://images.unsplash.com/photo-1540066019607-e5f69323a8dc?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1635990215204-e7dd7bbae49d?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1696581084306-591db2e1af14?auto=format&fit=crop&w=1400&q=80',
];

type LoadedModelProps = {
  modelPath: string;
  onReady: () => void;
};

function LoadedModel({ modelPath, onReady }: LoadedModelProps) {
  const gltf = useGLTF(modelPath);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useEffect(() => {
    scene.traverse((node: Object3D) => {
      const asMesh = node as THREE.Mesh;
      if (!asMesh.isMesh || !asMesh.material) {
        return;
      }

      const materials = Array.isArray(asMesh.material) ? asMesh.material : [asMesh.material];
      for (const material of materials) {
        const stdMaterial = material as THREE.MeshStandardMaterial;
        stdMaterial.metalness = Math.max(0.45, stdMaterial.metalness ?? 0.45);
        stdMaterial.roughness = Math.min(0.35, stdMaterial.roughness ?? 0.35);
      }
    });
  }, [scene]);

  return <primitive object={scene} scale={1.42} position={[0, 0.08, 0]} rotation={[0, Math.PI / 2, 0]} />;
}

function FallbackCar({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <group>
      <mesh position={[0, 0.33, 0]}>
        <capsuleGeometry args={[0.42, 1.25, 8, 24]} />
        <meshStandardMaterial color="#355dff" metalness={0.72} roughness={0.2} emissive="#1f2e9a" emissiveIntensity={0.26} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[2.6, 0.36, 1.15]} />
        <meshStandardMaterial color="#1e2b6b" metalness={0.72} roughness={0.24} emissive="#1c2563" emissiveIntensity={0.22} />
      </mesh>
      <mesh position={[-0.25, 0.55, 0]} castShadow>
        <boxGeometry args={[1.15, 0.34, 1.0]} />
        <meshStandardMaterial color="#2f44a2" metalness={0.64} roughness={0.26} />
      </mesh>
      <mesh position={[-0.26, 0.58, 0]}>
        <boxGeometry args={[0.86, 0.19, 0.9]} />
        <meshStandardMaterial color="#dbeafe" transparent opacity={0.45} metalness={0.25} roughness={0.08} />
      </mesh>

      <mesh position={[1.2, 0.26, 0.38]}>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshBasicMaterial color="#fde68a" />
      </mesh>
      <mesh position={[1.2, 0.26, -0.38]}>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>

      <mesh position={[0.9, -0.05, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.21, 0.08, 24, 36]} />
        <meshStandardMaterial color="#0b0b0d" metalness={0.28} roughness={0.5} />
      </mesh>
      <mesh position={[0.9, -0.05, -0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.21, 0.08, 24, 36]} />
        <meshStandardMaterial color="#0b0b0d" metalness={0.28} roughness={0.5} />
      </mesh>
      <mesh position={[-0.9, -0.05, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.21, 0.08, 24, 36]} />
        <meshStandardMaterial color="#0b0b0d" metalness={0.28} roughness={0.5} />
      </mesh>
      <mesh position={[-0.9, -0.05, -0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.21, 0.08, 24, 36]} />
        <meshStandardMaterial color="#0b0b0d" metalness={0.28} roughness={0.5} />
      </mesh>
    </group>
  );
}

function ShowroomImagePanels() {
  return (
    <group>
      <DreiImage
        url={SHOWROOM_IMAGE_URLS[0]}
        position={[-3.5, 1.5, -2.4]}
        rotation={[0.05, 0.58, 0]}
        scale={[2.4, 1.38]}
        transparent
        opacity={0.86}
      />
      <DreiImage
        url={SHOWROOM_IMAGE_URLS[1]}
        position={[3.45, 1.28, -2.2]}
        rotation={[0.02, -0.62, 0]}
        scale={[2.32, 1.34]}
        transparent
        opacity={0.82}
      />
      <DreiImage
        url={SHOWROOM_IMAGE_URLS[2]}
        position={[0, 2.05, -3.9]}
        rotation={[-0.05, 0, 0]}
        scale={[2.9, 1.58]}
        transparent
        opacity={0.75}
      />
    </group>
  );
}

export function Car({ reveal, phase, finalBurst, onReady, modelPath = '/models/carModel.glb' }: CarProps) {
  const carGroupRef = useRef<Group>(null);
  const [modelExists, setModelExists] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkModel = async () => {
      try {
        const response = await fetch(modelPath, { method: 'HEAD' });
        if (!isMounted) return;
        setModelExists(response.ok);
      } catch {
        if (!isMounted) return;
        setModelExists(false);
      }
    };

    void checkModel();

    return () => {
      isMounted = false;
    };
  }, [modelPath]);

  useFrame((state, delta) => {
    if (!carGroupRef.current) return;

    const t = state.clock.getElapsedTime();
    const targetY = Math.sin(t * 0.9) * 0.04;
    const targetRotateY = Math.sin(t * 0.3) * 0.12;

    const visibleScale = THREE.MathUtils.lerp(0.35, 1, reveal);
    const burstScale = phase === 6 ? THREE.MathUtils.lerp(1, 1.34, finalBurst) : 1;

    carGroupRef.current.position.y = THREE.MathUtils.damp(carGroupRef.current.position.y, targetY, 2.4, delta);
    carGroupRef.current.rotation.y = THREE.MathUtils.damp(carGroupRef.current.rotation.y, targetRotateY, 2.4, delta);
    carGroupRef.current.scale.setScalar(visibleScale * burstScale);
  });

  return (
    <>
      <group ref={carGroupRef}>
        {modelExists ? (
          <Suspense fallback={<FallbackCar onReady={onReady} />}>
            <LoadedModel modelPath={modelPath} onReady={onReady} />
          </Suspense>
        ) : (
          <FallbackCar onReady={onReady} />
        )}
      </group>

      <ShowroomImagePanels />

      <mesh receiveShadow position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <MeshReflectorMaterial
          blur={[280, 70]}
          resolution={1024}
          mixBlur={2.5}
          mixStrength={11}
          roughness={0.06}
          depthScale={0.45}
          minDepthThreshold={0.2}
          maxDepthThreshold={1.25}
          color="#0b1024"
          metalness={0.84}
        />
      </mesh>
    </>
  );
}

useGLTF.preload('/models/carModel.glb');
