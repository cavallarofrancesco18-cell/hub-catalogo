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

// This is a mock function as we can't access real-time external APIs.
// In a real application, this would call a service that provides vehicle data from a license plate.
async function fetchMockVehicleData(targa: string): Promise<GetVehicleDataFromPlateOutput> {
    console.log(`Fetching mock data for plate: ${targa}`);
    // Return some realistic mock data.
    return {
        marca: 'Audi',
        modello: 'A3',
        versione: 'Sportback 35 TFSI S tronic',
        data_immatricolazione: '2021-05-15',
        carburante: 'Benzina',
        cambio: 'Automatico',
        potenza: 150,
        potenza_kw: 110,
        cilindrata: 1498,
        classe_emissioni: 'Euro 6d',
    };
}


const getVehicleDataFromPlateFlow = ai.defineFlow(
  {
    name: 'getVehicleDataFromPlateFlow',
    inputSchema: GetVehicleDataFromPlateInputSchema,
    outputSchema: GetVehicleDataFromPlateOutputSchema,
  },
  async ({ targa }) => {
    // In a real scenario, you would call an external API here.
    // We are using a mock function for demonstration.
    return await fetchMockVehicleData(targa);
  }
);


export async function getVehicleDataFromPlate(input: GetVehicleDataFromPlateInput): Promise<GetVehicleDataFromPlateOutput> {
  return getVehicleDataFromPlateFlow(input);
}
