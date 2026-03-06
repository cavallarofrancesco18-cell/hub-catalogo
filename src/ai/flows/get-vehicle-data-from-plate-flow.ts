'use server';
/**
 * @fileOverview A Genkit flow for fetching vehicle data based on its license plate.
 *
 * - getVehicleDataFromPlate - A function that takes a license plate and returns vehicle specifications.
 * - GetVehicleDataFromPlateInput - The input type for the getVehicleDataFromPlate function.
 * - GetVehicleDataFromPlateOutput - The return type for the getVehicleDataFromPlate function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetVehicleDataFromPlateInputSchema = z.object({
  targa: z.string().describe('The Italian license plate of the vehicle (e.g., "GA123BU").'),
});
export type GetVehicleDataFromPlateInput = z.infer<typeof GetVehicleDataFromPlateInputSchema>;

const GetVehicleDataFromPlateOutputSchema = z.object({
    marca: z.string().optional().describe('The brand of the vehicle.'),
    modello: z.string().optional().describe('The model of the vehicle.'),
    versione: z.string().optional().describe('The version or trim level of the vehicle.'),
    data_immatricolazione: z.string().optional().describe('The first registration date of the vehicle (YYYY-MM-DD).'),
    carburante: z.enum(['Benzina', 'Diesel', 'Elettrica', 'Ibrida']).optional(),
    cambio: z.enum(['Manuale', 'Automatico']).optional(),
    potenza: z.number().optional().describe('The horsepower (CV) of the vehicle.'),
    potenza_kw: z.number().optional().describe('The power in kW of the vehicle.'),
    cilindrata: z.number().optional().describe('The engine displacement in cc.'),
    classe_emissioni: z.string().optional().describe('The emission class (e.g., "Euro 6").'),
});
export type GetVehicleDataFromPlateOutput = z.infer<typeof GetVehicleDataFromPlateOutputSchema>;


const getVehicleDataFromPlatePrompt = ai.definePrompt({
    name: 'getVehicleDataFromPlatePrompt',
    input: { schema: GetVehicleDataFromPlateInputSchema },
    output: { schema: GetVehicleDataFromPlateOutputSchema },
    prompt: `Sei un esperto di veicoli e hai accesso a un vasto database di informazioni automobilistiche italiane. Il tuo compito è recuperare i dati tecnici di un veicolo basandoti esclusivamente sulla targa fornita.

Targa: {{{targa}}}

Basandoti sulla targa, fornisci i dettagli tecnici più accurati possibili. Restituisci solo i dati che riesci a trovare con un alto grado di confidenza. Non inventare o dedurre informazioni se non sei sicuro. Se un'informazione non è disponibile, lasciala vuota.`,
});


const getVehicleDataFromPlateFlow = ai.defineFlow(
  {
    name: 'getVehicleDataFromPlateFlow',
    inputSchema: GetVehicleDataFromPlateInputSchema,
    outputSchema: GetVehicleDataFromPlateOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await getVehicleDataFromPlatePrompt(input);
      return output!;
    } catch (e: any) {
        console.error(`Error in getVehicleDataFromPlateFlow: ${e.message}`);
        throw e;
    }
  }
);


export async function getVehicleDataFromPlate(input: GetVehicleDataFromPlateInput): Promise<GetVehicleDataFromPlateOutput> {
  return getVehicleDataFromPlateFlow(input);
}
