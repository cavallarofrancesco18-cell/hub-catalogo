'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-seo-meta-description-flow.ts';
import '@/ai/flows/generate-vehicle-description.ts';
import '@/ai/flows/get-vehicle-data-from-plate-flow.ts';
