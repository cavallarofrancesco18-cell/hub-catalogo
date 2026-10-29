import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';

export type LoadingPhase = 1 | 2 | 3 | 4 | 5 | 6;

type LoadingState = {
  phase: LoadingPhase;
  progress: number;
  headlights: number;
  reveal: number;
  logo: number;
  tagline: number;
  finalBurst: number;
  isComplete: boolean;
};

type UseLoadingOptions = {
  assetsReady: boolean;
  minIntroMs?: number;
};

const INITIAL_STATE: LoadingState = {
  phase: 1,
  progress: 0,
  headlights: 0,
  reveal: 0,
  logo: 0,
  tagline: 0,
  finalBurst: 0,
  isComplete: false,
};

export function useLoading({ assetsReady, minIntroMs = 5200 }: UseLoadingOptions) {
  const [state, setState] = useState<LoadingState>(INITIAL_STATE);

  const valuesRef = useRef({
    driver: 0,
    progress: 0,
    headlights: 0,
    reveal: 0,
    logo: 0,
    tagline: 0,
    finalBurst: 0,
    phase: 1 as LoadingPhase,
  });
  const introDoneRef = useRef(false);
  const finalStartedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const delayedFinalRef = useRef<gsap.core.Tween | null>(null);

  const syncState = useMemo(
    () =>
      () => {
        const values = valuesRef.current;
        setState(previous => ({
          ...previous,
          phase: values.phase,
          progress: Math.max(0, Math.min(100, Math.round(values.progress))),
          headlights: values.headlights,
          reveal: values.reveal,
          logo: values.logo,
          tagline: values.tagline,
          finalBurst: values.finalBurst,
        }));
      },
    []
  );

  useEffect(() => {
    const values = valuesRef.current;
    const setPhase = (phase: LoadingPhase) => {
      values.phase = phase;
      syncState();
    };

    const introTimeline = gsap.timeline();

    introTimeline
      .to(values, {
        driver: 1,
        duration: 0.8,
        onStart: () => setPhase(1),
        onUpdate: syncState,
      })
      .to(values, {
        driver: 2,
        headlights: 1,
        duration: 1,
        ease: 'power1.inOut',
        onStart: () => setPhase(2),
        onUpdate: syncState,
      })
      .to(values, {
        driver: 3,
        reveal: 1,
        progress: 70,
        duration: 2,
        ease: 'power2.inOut',
        onStart: () => setPhase(3),
        onUpdate: syncState,
      })
      .to(values, {
        driver: 4,
        logo: 1,
        duration: 0.75,
        ease: 'power2.out',
        onStart: () => setPhase(4),
        onUpdate: syncState,
      })
      .to(values, {
        driver: 5,
        tagline: 1,
        progress: 92,
        duration: 0.9,
        ease: 'power2.out',
        onStart: () => setPhase(5),
        onUpdate: syncState,
        onComplete: () => {
          introDoneRef.current = true;
        },
      });

    return () => {
      introTimeline.kill();
      delayedFinalRef.current?.kill();
    };
  }, [syncState]);

  useEffect(() => {
    if (!assetsReady || !introDoneRef.current || finalStartedRef.current) {
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const delaySeconds = Math.max(0, minIntroMs - elapsed) / 1000;

    delayedFinalRef.current?.kill();
    delayedFinalRef.current = gsap.delayedCall(delaySeconds, () => {
      if (finalStartedRef.current) {
        return;
      }

      finalStartedRef.current = true;
      const values = valuesRef.current;
      const finalTimeline = gsap.timeline({
        onComplete: () => {
          setState(previous => ({ ...previous, isComplete: true }));
        },
      });

      values.phase = 6;

      finalTimeline
        .to(values, {
          progress: 100,
          finalBurst: 1,
          reveal: 1.14,
          duration: 0.55,
          ease: 'power3.in',
          onUpdate: syncState,
        })
        .to(values, {
          finalBurst: 0,
          duration: 0.32,
          ease: 'power1.out',
          onUpdate: syncState,
        });
    });

    return () => {
      delayedFinalRef.current?.kill();
    };
  }, [assetsReady, minIntroMs, syncState]);

  return state;
}
