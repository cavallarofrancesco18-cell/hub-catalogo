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
  prompt: `Sei un copywriter automotive senior. Scrivi una descrizione in stile annuncio moderno, elegante e commerciale, basata sui dati veicolo e su cio che e visibile nelle immagini.

Regole fondamentali:
- Non inventare optional, accessori o condizioni non verificabili.
- Se un elemento non e chiaramente visibile, non citarlo come certo.
- Tono professionale, scorrevole e orientato alla vendita, senza esagerazioni.
- Nessun elenco puntato: testo in paragrafi brevi.

Struttura richiesta:
1) Apertura d'impatto con modello/versione e posizionamento del veicolo.
2) Paragrafo su estetica e abitacolo (solo elementi confermati da immagini/dati).
3) Paragrafo su utilizzo quotidiano e vantaggi pratici (es. comfort, versatilita, tecnologia visibile).
4) Chiusura con call-to-action sobria.

Lunghezza target: 120-180 parole.

Dati del veicolo:
Marca: {{{marca}}}
Modello: {{{modello}}}
Versione: {{{versione}}}
Anno: {{{anno}}}
Chilometraggio: {{{chilometraggio}}} km
Carburante: {{{carburante}}}
Cambio: {{{cambio}}}
Potenza: {{{potenza}}} CV
Colore Esterno: {{{colore_esterno}}}
{{#if prezzo}}Prezzo: {{{prezzo}}}{{/if}}

{{#if immagini}}
Immagini da analizzare:
{{#each immagini}}
{{media url=this}}
{{/each}}
{{/if}}

Restituisci solo il testo finale della descrizione, pronto per la scheda annuncio.
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
