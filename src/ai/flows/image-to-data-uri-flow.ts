'use server';
/**
 * @fileOverview A utility flow to convert an image URL to a Data URI.
 * This is used to bypass CORS issues when rendering images from external sources into a canvas.
 *
 * - imageUrlToDataUri - A function that fetches an image and returns it as a Data URI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ImageUrlToDataUriInputSchema = z.string().url();
export type ImageUrlToDataUriInput = z.infer<typeof ImageUrlToDataUriInputSchema>;

const ImageUrlToDataUriOutputSchema = z.string();
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
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type') || 'image/png';
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return `data:${contentType};base64,${base64}`;
    } catch (error: any) {
        console.error(`Error converting image URL to data URI: ${error.message}`);
        // Return an empty string on error to prevent crashes.
        return '';
    }
  }
);
