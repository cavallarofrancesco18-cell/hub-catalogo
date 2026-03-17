'use server';
/**
 * @fileOverview A Genkit flow for converting an image URL to a Data URI.
 * This is used to bypass browser CORS restrictions when embedding images in generated PDFs.
 *
 * - imageUrlToDataUri - A function that fetches an image and returns it as a Data URI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ImageUrlToDataUriInputSchema = z.string().url().describe('The public URL of the image to convert.');
export type ImageUrlToDataUriInput = z.infer<typeof ImageUrlToDataUriInputSchema>;

const ImageUrlToDataUriOutputSchema = z.string().describe('The image represented as a Data URI (e.g., data:image/png;base64,...).');
export type ImageUrlToDataUriOutput = z.infer<typeof ImageUrlToDataUriOutputSchema>;

export async function imageUrlToDataUri(input: ImageUrlToDataUriInput): Promise<ImageUrlToDataUriOutput> {
  return imageUrlToDataUriFlow(input);
}

const imageUrlToDataUriFlow = ai.defineFlow(
  {
    name: 'imageUrlToDataUriFlow',
    inputSchema: ImageUrlToDataUriInputSchema,
    outputSchema: ImageUrlToDataUriOutputSchema,
  },
  async (url) => {
    try {
      if (!url) {
        return '';
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      
      return `data:${contentType};base64,${base64}`;

    } catch (e: any) {
      console.error(`Error in imageUrlToDataUriFlow: ${e.message}`);
      // Return an empty string on error to prevent crashing.
      return '';
    }
  }
);
