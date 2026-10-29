'use client';

import { useState } from 'react';

type VehicleVideoPlayerProps = {
  src: string;
  className?: string;
  title?: string;
};

export function VehicleVideoPlayer({
  src,
  className,
  title = 'Video del veicolo',
}: VehicleVideoPlayerProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        key={src}
        src={src}
        controls
        playsInline
        preload="metadata"
        className={className}
        aria-label={title}
        onCanPlay={() => setHasError(false)}
        onError={() => {
          console.error('Impossibile riprodurre il video del veicolo.');
          setHasError(true);
        }}
      />
      {hasError && (
        <p role="alert" className="absolute inset-x-3 bottom-12 rounded bg-black/80 p-2 text-center text-sm text-white">
          Questo video non può essere riprodotto. Verifica il formato o riprova più tardi.
        </p>
      )}
    </div>
  );
}
