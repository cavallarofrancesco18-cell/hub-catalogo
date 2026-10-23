import type { VehicleImageCategory } from '@/lib/types';

type ClassificationSource = 'ai' | 'filename' | 'fallback';

export type VehicleImageAutoCategoryResult = {
  category: VehicleImageCategory;
  confidence: number;
  source: ClassificationSource;
};

const filenameKeywordMatchers: Array<{
  category: VehicleImageCategory;
  keywords: string[];
}> = [
  {
    category: 'kilometri',
    keywords: ['km', 'kilometri', 'odometro', 'contachilometri', 'dashboard', 'cruscotto'],
  },
  {
    category: 'libretto',
    keywords: ['libretto', 'carta-circolazione', 'circolazione', 'documento', 'documenti'],
  },
  {
    category: 'dettaglio-danni',
    keywords: ['danno', 'danni', 'graffio', 'ammaccatura', 'imperfezione', 'difetto'],
  },
  {
    category: 'cerchi',
    keywords: ['cerchio', 'cerchi', 'ruota', 'ruote', 'pneumatico', 'pneumatici'],
  },
  {
    category: 'baule',
    keywords: ['baule', 'trunk', 'bagagliaio'],
  },
  {
    category: 'interno',
    keywords: ['interno', 'interni', 'abitacolo', 'plancia', 'sedili', 'cockpit'],
  },
  {
    category: 'fronte-dx',
    keywords: ['frontedx', 'fronte-dx', 'fronte_dx', 'anteriore-dx', 'anteriore_dx', 'front-right', 'front_right'],
  },
  {
    category: 'fronte-sx',
    keywords: ['frontesx', 'fronte-sx', 'fronte_sx', 'anteriore-sx', 'anteriore_sx', 'front-left', 'front_left'],
  },
  {
    category: 'posteriore-dx',
    keywords: ['posterioredx', 'posteriore-dx', 'posteriore_dx', 'retro-dx', 'retro_dx', 'rear-right', 'rear_right'],
  },
  {
    category: 'posteriore-sx',
    keywords: ['posterioresx', 'posteriore-sx', 'posteriore_sx', 'retro-sx', 'retro_sx', 'rear-left', 'rear_left'],
  },
];

const inferCategoryFromFilename = (fileName: string): VehicleImageAutoCategoryResult | null => {
  const normalized = fileName
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-');

  for (const matcher of filenameKeywordMatchers) {
    if (matcher.keywords.some(keyword => normalized.includes(keyword))) {
      return {
        category: matcher.category,
        confidence: 0.55,
        source: 'filename',
      };
    }
  }

  return null;
};

const readImageAsDataUrl = async (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('INVALID_DATA_URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(file);
  });

const downscaleImageDataUrl = async (file: File): Promise<string> => {
  const originalDataUrl = await readImageAsDataUrl(file);

  return new Promise(resolve => {
    const image = new Image();

    image.onload = () => {
      const maxSide = 1024;
      const longestSide = Math.max(image.width, image.height);

      if (longestSide <= maxSide) {
        resolve(originalDataUrl);
        return;
      }

      const scale = maxSide / longestSide;
      const targetWidth = Math.max(1, Math.round(image.width * scale));
      const targetHeight = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(originalDataUrl);
        return;
      }

      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };

    image.onerror = () => resolve(originalDataUrl);
    image.src = originalDataUrl;
  });
};

const classifyByAi = async (
  imageDataUrl: string,
  fallbackCategory: VehicleImageCategory,
  idToken: string
): Promise<VehicleImageAutoCategoryResult | null> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch('/api/admin/classify-vehicle-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ imageDataUrl, fallbackCategory }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json().catch(() => null)) as
      | { category?: VehicleImageCategory; confidence?: number }
      | null;

    if (!body?.category || typeof body.confidence !== 'number') {
      return null;
    }

    const confidence = Number.isFinite(body.confidence)
      ? Math.min(1, Math.max(0, body.confidence))
      : 0;

    return {
      category: body.category,
      confidence,
      source: 'ai',
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export async function classifyVehicleImageAutoCategory(params: {
  file: File;
  fallbackCategory: VehicleImageCategory;
  idToken?: string;
  allowCategory?: (category: VehicleImageCategory) => boolean;
}): Promise<VehicleImageAutoCategoryResult> {
  const { file, fallbackCategory, idToken, allowCategory } = params;

  const filenameGuess = inferCategoryFromFilename(file.name);
  const isFilenameAllowed =
    filenameGuess && (!allowCategory || allowCategory(filenameGuess.category));

  let aiResult: VehicleImageAutoCategoryResult | null = null;

  if (idToken && file.type.startsWith('image/')) {
    const imageDataUrl = await downscaleImageDataUrl(file);
    aiResult = await classifyByAi(imageDataUrl, fallbackCategory, idToken);
  }

  if (aiResult && (!allowCategory || allowCategory(aiResult.category)) && aiResult.confidence >= 0.6) {
    return aiResult;
  }

  if (isFilenameAllowed) {
    return filenameGuess;
  }

  return {
    category: fallbackCategory,
    confidence: 0,
    source: 'fallback',
  };
}
