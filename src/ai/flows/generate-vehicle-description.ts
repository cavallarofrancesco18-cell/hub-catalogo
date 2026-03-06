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
  prezzo: z.number().describe('The selling price of the vehicle.'),
  immagini: z.array(z.string()).optional().describe('An array of Data URIs for the vehicle images to be visually analyzed.'),
});
export type GenerateVehicleDescriptionInput = z.infer<typeof GenerateVehicleDescriptionInputSchema>;

const GenerateVehicleDescriptionOutputSchema = z
  .string()
  .describe('A compelling commercial description for the vehicle, highlighting its key selling points.');
export type GenerateVehicleDescriptionOutput = z.infer<typeof GenerateVehicleDescriptionOutputSchema>;


const generateVehicleDescriptionFlow = ai.defineFlow(
  {
    name: 'generateVehicleDescriptionFlow',
    inputSchema: GenerateVehicleDescriptionInputSchema,
    outputSchema: GenerateVehicleDescriptionOutputSchema,
  },
  async (input) => {
    
    const textPrompt = `Sei un esperto di marketing per una concessionaria di auto di lusso e moderne.

Genera una descrizione commerciale accattivante e persuasiva per il seguente veicolo, analizzando sia i dati tecnici che le immagini fornite per evidenziare i punti di forza, le caratteristiche uniche e l'estetica che attireranno un acquirente sofisticato. Concentrati sull'esperienza di guida, sul design, sugli optional visibili e sul valore del veicolo.

Non includere il prezzo finale nella descrizione, ma enfatizza il valore e la qualità.

Informazioni sul veicolo:
Marca: ${input.marca}
Modello: ${input.modello}
Versione: ${input.versione}
Anno: ${input.anno}
Chilometraggio: ${input.chilometraggio} km
Carburante: ${input.carburante}
Cambio: ${input.cambio}
Potenza: ${input.potenza} CV
Colore Esterno: ${input.colore_esterno}

${(input.immagini && input.immagini.length > 0) ? `\nAnalizza anche queste immagini caricate per dettagli aggiuntivi su design, interni e condizioni:\n` : ''}
`;

    const promptParts: (string | { media: { url: string } })[] = [textPrompt];

    if (input.immagini) {
        for (const dataUri of input.immagini) {
            promptParts.push({ media: { url: dataUri } });
        }
    }

    const { text } = await ai.generate({
        prompt: promptParts,
    });

    return text;
  }
);

export async function generateVehicleDescription(input: GenerateVehicleDescriptionInput): Promise<GenerateVehicleDescriptionOutput> {
  return generateVehicleDescriptionFlow(input);
}
