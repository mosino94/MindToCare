'use server';
/**
 * @fileOverview AI flow to refine user bios.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

/**
 * Refines a user bio using AI.
 * @param bio The original bio text.
 * @returns The refined bio text.
 */
export async function refineBio(bio: string): Promise<string> {
  const { text } = await ai.generate({
    model: 'googleai/gemini-1.5-flash',
    prompt: `Refine this user bio to be more engaging and empathetic for a supportive community platform while keeping it professional and concise: ${bio}`,
  });
  return text;
}
