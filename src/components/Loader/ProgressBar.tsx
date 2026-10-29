type ProgressBarProps = {
  progress: number;
  visible: number;
};

export function ProgressBar({ progress, visible }: ProgressBarProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const safeVisible = Math.max(0, Math.min(1, visible));

  return (
    <div
      style={{
        marginTop: '0.9rem',
        opacity: safeVisible,
        transform: `translateY(${(1 - safeVisible) * 10}px)`,
        transition: 'opacity 240ms ease, transform 240ms ease',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          height: '6px',
          width: '100%',
          borderRadius: '999px',
          background: 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.18))',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 18px rgba(255,255,255,0.09)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${safeProgress}%`,
            borderRadius: '999px',
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.92), rgba(214,214,214,0.85) 54%, rgba(255,255,255,0.96))',
            boxShadow: '0 0 18px rgba(255,255,255,0.45)',
            transition: 'width 180ms linear',
            position: 'relative',
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: 0,
              transform: 'translateX(-100%) skewX(-22deg)',
              width: '36%',
              background: 'rgba(255,255,255,0.5)',
              animation: 'loaderShine 1.2s ease-in-out infinite',
            }}
          />
        </div>
      </div>
      <style jsx>{`
        @keyframes loaderShine {
          to {
            transform: translateX(240%) skewX(-22deg);
          }
        }
      `}</style>
    </div>
  );
}
