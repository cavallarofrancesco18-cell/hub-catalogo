import styles from './Loader.module.css';

type LogoProps = {
  opacity: number;
};

export function Logo({ opacity }: LogoProps) {
  const safeOpacity = Math.max(0, Math.min(1, opacity));

  return (
    <div
      className={styles.caption}
      style={{
        opacity: safeOpacity,
        transform: `translateY(${(1 - safeOpacity) * 14}px)`,
        transition: 'opacity 240ms ease, transform 240ms ease',
      }}
      aria-live="polite"
    >
      <p
        style={{
          margin: 0,
          fontSize: 'clamp(1.1rem, 2vw, 1.7rem)',
          letterSpacing: '0.17em',
          fontWeight: 600,
          color: '#fff',
          textTransform: 'uppercase',
          textShadow: '0 0 18px rgba(255,255,255,0.25)',
        }}
      >
        AUTOTRADE
      </p>
      <p
        style={{
          margin: '0.24rem 0 0',
          fontSize: 'clamp(0.78rem, 1.4vw, 1rem)',
          letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.78)',
        }}
      >
        by HUB Mobility
      </p>
    </div>
  );
}
