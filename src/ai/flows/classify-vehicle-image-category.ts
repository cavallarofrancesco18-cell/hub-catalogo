'use server';

import { z } from 'genkit';

import { ai } from '@/ai/genkit';

const CATEGORY_VALUES = [
  'showroom-hub',
  'fronte-dx',
  'fronte-sx',
  'posteriore-sx',
  'posteriore-dx',
  'interno',
  'cerchi',
  'baule',
  'dettaglio-danni',
  'kilometri',
  'libretto',
  'generica',
] as const;

const ClassifyVehicleImageCategoryInputSchema = z.object({
  imageDataUrl: z.string().min(1),
  fallbackCategory: z.enum(CATEGORY_VALUES).optional(),
});

const ClassifyVehicleImageCategoryOutputSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  confidence: z.number().min(0).max(1),
});

export type ClassifyVehicleImageCategoryInput = z.infer<typeof ClassifyVehicleImageCategoryInputSchema>;
export type ClassifyVehicleImageCategoryOutput = z.infer<typeof ClassifyVehicleImageCategoryOutputSchema>;

const classifyVehicleImageCategoryPrompt = ai.definePrompt({
  name: 'classifyVehicleImageCategoryPrompt',
  input: { schema: ClassifyVehicleImageCategoryInputSchema },
  output: { schema: ClassifyVehicleImageCategoryOutputSchema },
  prompt: `Analizza l'immagine del veicolo e scegli una sola categoria tra queste:
- showroom-hub
- fronte-dx
- fronte-sx
- posteriore-sx
- posteriore-dx
- interno
- cerchi
- baule
- dettaglio-danni
- kilometri
- libretto
- generica

Regole:
- Usa "showroom-hub" solo quando nella foto e presente un'auto davanti all'allestimento HUB: parete chiara con grande logo nero, faretti a soffitto e pavimento lucido. Il logo o la parete possono essere parzialmente coperti dall'auto.
- Non usare "showroom-hub" per una foto del fondale vuoto, per un altro showroom o per un'auto senza questo allestimento riconoscibile.
- Quando riconosci con certezza l'allestimento HUB, preferisci "showroom-hub" alle categorie di angolazione.
- Se non sei sicuro almeno al 60%, usa "generica".
- Usa "kilometri" solo per cruscotto/contachilometri ben visibile.
- Usa "libretto" solo se il documento e chiaramente una carta/libretto.
- Usa "dettaglio-danni" solo se il focus principale e un danno/imperfezione.
- Mantieni la confidenza tra 0 e 1.

Categoria fallback (se presente): {{fallbackCategory}}

Immagine:
{{media url=imageDataUrl}}`,
});

const classifyVehicleImageCategoryFlow = ai.defineFlow(
  {
    name: 'classifyVehicleImageCategoryFlow',
    inputSchema: ClassifyVehicleImageCategoryInputSchema,
    outputSchema: ClassifyVehicleImageCategoryOutputSchema,
  },
  async input => {
    try {
      const { output } = await classifyVehicleImageCategoryPrompt(input);

      if (!output) {
        return {
          category: input.fallbackCategory ?? 'generica',
          confidence: 0,
        };
      }

      return output;
    } catch (error) {
      console.error('Error in classifyVehicleImageCategoryFlow:', error);
      return {
        category: input.fallbackCategory ?? 'generica',
        confidence: 0,
      };
    }
  }
);

export async function classifyVehicleImageCategory(
  input: ClassifyVehicleImageCategoryInput
): Promise<ClassifyVehicleImageCategoryOutput> {
  return classifyVehicleImageCategoryFlow(input);
}
