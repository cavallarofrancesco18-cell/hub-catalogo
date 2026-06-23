'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Video360ViewerProps = {
  src: string;
  className?: string;
};

export function Video360Viewer({ src, className }: Video360ViewerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let destroyed = false;
    let viewer: any = null;
    let readyTimeout: ReturnType<typeof setTimeout> | null = null;

    const initialize = async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        const PSV = await import('photo-sphere-viewer');
        const { Viewer, EquirectangularAdapter } = PSV;

        if (destroyed || !containerRef.current) {
          return;
        }

        viewer = new Viewer({
          container: containerRef.current,
          adapter: [EquirectangularAdapter, { resolution: 64 }],
          panorama: src,
          navbar: [],
          mousewheel: false,
          touchmoveTwoFingers: false,
        });

        // Se non è pronto in tempo, mostriamo fallback video normale.
        readyTimeout = setTimeout(() => {
          if (!destroyed) {
            console.warn('Video 360 viewer timeout - falling back to standard video player.');
            setHasError(true);
          }
        }, 2000);

        viewer.addEventListener?.('panorama-loaded', () => {
          if (readyTimeout) {
            clearTimeout(readyTimeout);
            readyTimeout = null;
          }
          if (!destroyed) {
            setHasError(false);
          }
        });

        viewer.addEventListener?.('error', (event: any) => {
          console.error('Video 360 viewer error:', event);
          if (readyTimeout) {
            clearTimeout(readyTimeout);
            readyTimeout = null;
          }
          if (!destroyed) {
            setHasError(true);
          }
        });
      } catch (error) {
        console.error('Video 360 viewer initialization failed.', error);
        if (!destroyed) {
          setHasError(true);
        }
      }
    };

    setHasError(false);
    void initialize();

    return () => {
      destroyed = true;
      if (readyTimeout) {
        clearTimeout(readyTimeout);
      }
      viewer?.destroy();
    };
  }, [src]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && wrapperRef.current) {
        await wrapperRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen not available.', error);
    }
  };

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      {hasError ? (
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className={className}
        />
      ) : (
        <div ref={containerRef} className={className} />
      )}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute right-3 top-3 z-10 h-8 w-8 bg-black/65 text-white hover:bg-black/80"
        onClick={() => void toggleFullscreen()}
        aria-label={isFullscreen ? 'Chiudi schermo intero' : 'Apri schermo intero'}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
