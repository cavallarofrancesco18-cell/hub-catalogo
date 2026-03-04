'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageGalleryProps {
  imageUrls: string[];
  startIndex?: number;
  onClose: () => void;
}

export function ImageGallery({ imageUrls, startIndex = 0, onClose }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  const goToPrevious = () => {
    setCurrentIndex(prevIndex => (prevIndex === 0 ? imageUrls.length - 1 : prevIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prevIndex => (prevIndex === imageUrls.length - 1 ? 0 : prevIndex + 1));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        goToNext();
      } else if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrls]);

  if (!imageUrls || imageUrls.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-lg font-medium">{`${currentIndex + 1} / ${imageUrls.length}`}</span>
        <button onClick={onClose} className="rounded-full p-2 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white">
          <X className="h-6 w-6" />
          <span className="sr-only">Chiudi galleria</span>
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <button
          onClick={goToPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <ChevronLeft className="h-8 w-8" />
          <span className="sr-only">Immagine precedente</span>
        </button>

        <div className="relative h-full w-full max-h-[85vh] max-w-[85vw]">
          <Image
            key={currentIndex}
            src={imageUrls[currentIndex]}
            alt={`Immagine ${currentIndex + 1}`}
            fill
            className="object-contain"
            sizes="85vw"
            priority
          />
        </div>

        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <ChevronRight className="h-8 w-8" />
          <span className="sr-only">Immagine successiva</span>
        </button>
      </div>

       <div className="p-4 overflow-x-auto">
          <div className="mx-auto flex h-24 items-center justify-center gap-2">
            {imageUrls.map((url, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  'relative h-16 w-24 shrink-0 overflow-hidden rounded-md focus:outline-none focus:ring-2 focus:ring-white',
                  index === currentIndex && 'ring-2 ring-white'
                )}
              >
                <Image
                  src={url}
                  alt={`Anteprima ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="10vw"
                />
              </button>
            ))}
          </div>
        </div>
    </div>
  );
}
