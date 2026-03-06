'use server';
/**
 * @fileOverview A Genkit flow for generating compelling commercial descriptions for vehicles.
 *
 * - generateVehicleDescription - A function that generates a commercial description for a vehicle.
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
  .describe('A compelling commercial description for the vehicle, highlighting its key selling points.');
export type GenerateVehicleDescriptionOutput = z.infer<typeof GenerateVehicleDescriptionOutputSchema>;


const prompt = ai.definePrompt({
    name: 'generateVehicleDescriptionPrompt',
    input: { schema: GenerateVehicleDescriptionInputSchema },
    output: { format: 'text' },
    prompt: `Sei un esperto di marketing per una concessionaria di auto di lusso e moderne.

Genera una descrizione commerciale accattivante e persuasiva per il seguente veicolo, analizzando sia i dati tecnici che le immagini fornite per evidenziare i punti di forza, le caratteristiche uniche e l'estetica che attireranno un acquirente sofisticato. Concentrati sull'esperienza di guida, sul design, sugli optional visibili e sul valore del veicolo.

Non includere il prezzo finale nella descrizione, ma enfatizza il valore e la qualità.

Informazioni sul veicolo:
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
Analizza anche queste immagini caricate per dettagli aggiuntivi su design, interni e condizioni:
{{#each immagini}}
{{media url=this}}
{{/each}}
{{/if}}
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
        throw e;
    }
  }
);

export async function generateVehicleDescription(input: GenerateVehicleDescriptionInput): Promise<GenerateVehicleDescriptionOutput> {
  return generateVehicleDescriptionFlow(input);
}
