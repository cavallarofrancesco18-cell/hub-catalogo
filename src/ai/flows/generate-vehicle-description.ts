'use server';
/**
 * @fileOverview A Genkit flow for identifying a vehicle's options and features from images.
 *
 * - generateVehicleDescription - A function that generates a description of a vehicle's visible options.
 * - GenerateVehicleDescriptionInput - The input type for the generateVehicleDescription function.
 * - GenerateVehicleDescriptionOutput - The return type for the generateVehicleDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateVehicleDescriptionInputSchema = z.object({
  marca: z.string().describe('The brand of the vehicle.'),
  modello: z.string().describe('The model of the vehicle.'),
  versione: z.string().describe('The version or trim level of the vehicle.'),
  anno: z.number().describe('The manufacturing year of the vehicle.'),
  chilometraggio: z.number().describe('The mileage of the vehicle in kilometers.'),
  carburante: z.string().describe('The fuel type of the vehicle (e.g., Benzina, Diesel, Elettrica).'),
  cambio: z.string().describe('The transmission type of the vehicle (e.g., Manuale, Automatico).'),
  potenza: z.number().describe('The horsepower (CV) of the vehicle.'),
  colore_esterno: z.string().describe('The exterior color of the vehicle.'),
  prezzo: z.number().optional().describe('The selling price of the vehicle.'),
  immagini: z.array(z.string().url()).optional().describe('An array of image URLs or Data URIs for the vehicle images to be visually analyzed.'),
});
export type GenerateVehicleDescriptionInput = z.infer<typeof GenerateVehicleDescriptionInputSchema>;

const GenerateVehicleDescriptionOutputSchema = z
  .string()
  .describe("A description of the vehicle's visible options, trims, and special features based on image analysis.");
export type GenerateVehicleDescriptionOutput = z.infer<typeof GenerateVehicleDescriptionOutputSchema>;


const prompt = ai.definePrompt({
    name: 'generateVehicleDescriptionPrompt',
    input: { schema: GenerateVehicleDescriptionInputSchema },
    output: { format: 'text' },
    prompt: `Sei un esperto di automobili. Il tuo compito è analizzare le immagini fornite di un veicolo e scrivere un testo che elenchi gli optional, gli allestimenti e le caratteristiche speciali che sono chiaramente visibili nelle foto.

Focalizzati esclusivamente su ciò che puoi osservare. Non fare supposizioni o aggiungere informazioni non visibili.

Usa i dati del veicolo solo come riferimento per il contesto, ma basa la tua descrizione principalmente sull'analisi visiva delle immagini.

Dati del veicolo per contesto:
Marca: {{{marca}}}
Modello: {{{modello}}}
Versione: {{{versione}}}
Anno: {{{anno}}}
Chilometraggio: {{{chilometraggio}}} km
Carburante: {{{carburante}}}
Cambio: {{{cambio}}}
Potenza: {{{potenza}}} CV
Colore Esterno: {{{colore_esterno}}}

{{#if immagini}}
Immagini da analizzare:
{{#each immagini}}
{{media url=this}}
{{/each}}
{{/if}}

Il risultato deve essere una descrizione concisa che mette in evidenza solo gli optional e le dotazioni visibili. Esempio: "Dotata di tetto panoramico apribile, cerchi in lega da 19 pollici, interni in pelle nera, sistema di infotainment con schermo touchscreen e fari Full LED."
`,
});


const generateVehicleDescriptionFlow = ai.defineFlow(
  {
    name: 'generateVehicleDescriptionFlow',
    inputSchema: GenerateVehicleDescriptionInputSchema,
    outputSchema: GenerateVehicleDescriptionOutputSchema,
  },
  async (input) => {
    try {
      const { text } = await prompt(input);
      return text;
    } catch (e: any) {
        console.error(`Error in generateVehicleDescriptionFlow: ${e.message}`);
        // Return an empty string on error to prevent crashing the server action.
        return '';
    }
  }
);

export async function generateVehicleDescription(input: GenerateVehicleDescriptionInput): Promise<GenerateVehicleDescriptionOutput> {
  return generateVehicleDescriptionFlow(input);
}
