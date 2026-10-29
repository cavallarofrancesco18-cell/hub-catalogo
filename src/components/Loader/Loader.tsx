'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './Loader.module.css';
import { Logo } from './Logo';
import { ProgressBar } from './ProgressBar';
import { Scene } from './Scene';
import { useLoading } from '@/hooks/useLoading';

const SHOWROOM_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1540066019607-e5f69323a8dc?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1635990215204-e7dd7bbae49d?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1696581084306-591db2e1af14?auto=format&fit=crop&w=1400&q=80',
];

type LoaderProps = {
  onComplete?: () => void;
};

export function Loader({ onComplete }: LoaderProps) {
  const [assetsReady, setAssetsReady] = useState(false);

  const { phase, progress, headlights, reveal, logo, tagline, finalBurst, isComplete } = useLoading({
    assetsReady,
  });

  const noiseOpacity = useMemo(() => 0.06 + 0.07 * Math.max(headlights, reveal), [headlights, reveal]);

  useEffect(() => {
    if (!isComplete || !onComplete) {
      return;
    }

    onComplete();
  }, [isComplete, onComplete]);

  return (
    <section className={styles.loader} aria-label="Cinematic loading experience">
      <div className={styles.backdrop} />

      <div className={styles.canvasWrap}>
        <Scene
          phase={phase}
          reveal={reveal}
          headlights={headlights}
          finalBurst={finalBurst}
          onModelReady={() => setAssetsReady(true)}
        />
      </div>

      <div className={styles.visualFallback} aria-hidden="true">
        <div className={styles.colorWash} />
        <img src={SHOWROOM_FALLBACK_IMAGES[0]} alt="" className={styles.photoLeft} />
        <img src={SHOWROOM_FALLBACK_IMAGES[1]} alt="" className={styles.photoRight} />
        <img src={SHOWROOM_FALLBACK_IMAGES[2]} alt="" className={styles.photoCenter} />
      </div>

      <div className={styles.grain} style={{ opacity: noiseOpacity }} />

      <div className={styles.overlay}>
        <div className={styles.topFade} />

        <div className={styles.bottomBlock}>
          <div className={styles.metaRow}>
            <div className={styles.metaLeft}>
              <span className={styles.badge}>Phase {phase}</span>
              <Logo opacity={logo} />
            </div>
            <span className={styles.badge}>{progress}%</span>
          </div>

          <p
            className={styles.tagline}
            style={{
              opacity: tagline,
              margin: 0,
              color: 'rgba(255,255,255,0.84)',
              letterSpacing: '0.03em',
              fontSize: 'clamp(0.78rem, 1.4vw, 1rem)',
              textShadow: '0 0 12px rgba(255,255,255,0.14)',
            }}
          >
            Preparing your next vehicle...
          </p>

          <ProgressBar progress={progress} visible={tagline} />
        </div>
      </div>

      <div
        className={styles.flash}
        style={{ opacity: Math.max(0, Math.min(1, finalBurst)), transition: 'opacity 100ms linear' }}
      />
    </section>
  );
}

export default Loader;
