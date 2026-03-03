'use server';
/**
 * @fileOverview This file provides an AI tool to generate SEO-optimized meta descriptions for vehicle detail pages.
 *
 * - generateSeoMetaDescription - A function to generate a meta description based on vehicle data.
 * - GenerateSeoMetaDescriptionInput - The input type for the generateSeoMetaDescription function.
 * - GenerateSeoMetaDescriptionOutput - The return type for the generateSeoMetaDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSeoMetaDescriptionInputSchema = z.object({
  brand: z.string().describe('The brand of the vehicle (e.g., "Fiat", "Mercedes-Benz").'),
  model: z.string().describe('The model of the vehicle (e.g., "Panda", "Classe A").'),
  version: z.string().optional().describe('The specific version or trim of the vehicle.'),
  year: z.number().describe('The manufacturing year of the vehicle.'),
  mileage: z.number().describe('The mileage of the vehicle in kilometers.'),
  fuel: z.string().describe('The fuel type of the vehicle (e.g., "Benzina", "Diesel", "Elettrica").'),
  transmission: z.string().describe('The transmission type of the vehicle (e.g., "Manuale", "Automatico").'),
  power: z.number().optional().describe('The power of the vehicle in horsepower (CV).'),
  exteriorColor: z.string().optional().describe('The exterior color of the vehicle.'),
  price: z.number().describe('The selling price of the vehicle.'),
  description: z.string().optional().describe('An existing commercial description or key selling points of the vehicle.'),
});
export type GenerateSeoMetaDescriptionInput = z.infer<typeof GenerateSeoMetaDescriptionInputSchema>;

const GenerateSeoMetaDescriptionOutputSchema = z.object({
  metaDescription: z.string().max(160).describe('An SEO-optimized meta description for the vehicle, under 160 characters.'),
});
export type GenerateSeoMetaDescriptionOutput = z.infer<typeof GenerateSeoMetaDescriptionOutputSchema>;

export async function generateSeoMetaDescription(
  input: GenerateSeoMetaDescriptionInput
): Promise<GenerateSeoMetaDescriptionOutput> {
  return generateSeoMetaDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSeoMetaDescriptionPrompt',
  input: {schema: GenerateSeoMetaDescriptionInputSchema},
  output: {schema: GenerateSeoMetaDescriptionOutputSchema},
  prompt: `Genera una meta description accattivante e SEO-friendly (massimo 160 caratteri) per l'annuncio di un veicolo in vendita, utilizzando i seguenti dettagli:

Marca: {{{brand}}}
Modello: {{{model}}}
Anno: {{{year}}}
Chilometraggio: {{{mileage}}} km
Carburante: {{{fuel}}}
Cambio: {{{transmission}}}
{{#if version}}Versione: {{{version}}}{{/if}}
{{#if power}}Potenza: {{{power}}} CV{{/if}}
{{#if exteriorColor}}Colore esterno: {{{exteriorColor}}}{{/if}}
Prezzo: {{price}} EUR
{{#if description}}Descrizione aggiuntiva/Punti di forza: {{{description}}}{{/if}}

Focus sulla promozione del veicolo, evidenziando i suoi punti di forza e incoraggiando il click-through. La meta description deve essere concisa e informativa. Assicurati che la lunghezza non superi i 160 caratteri.`,
});

const generateSeoMetaDescriptionFlow = ai.defineFlow(
  {
    name: 'generateSeoMetaDescriptionFlow',
    inputSchema: GenerateSeoMetaDescriptionInputSchema,
    outputSchema: GenerateSeoMetaDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
