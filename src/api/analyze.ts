import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import type { AnalysisResult } from '@/lib/types';

/**
 * Gemini downsamples large images anyway, and a smaller payload means a faster
 * round trip on a phone connection. 1024px on the long edge keeps enough detail
 * to read portion sizes.
 */
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.7;

export type PreparedImage = {
  /** Local file URI of the compressed copy, suitable for upload and preview. */
  uri: string;
  base64: string;
};

export async function prepareImage(uri: string): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(uri);
  const rendered = await context.resize({ width: MAX_EDGE }).renderAsync();
  const saved = await rendered.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!saved.base64) {
    throw new Error('Could not read the photo. Try taking it again.');
  }

  return { uri: saved.uri, base64: saved.base64 };
}

export async function analyzeMeal(base64: string, hint?: string): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke<AnalysisResult & { error?: string }>(
    'analyze-meal',
    {
      body: { image_base64: base64, mime_type: 'image/jpeg', hint },
    }
  );

  if (error) {
    // The Edge Function puts a human-readable reason in the response body, which
    // FunctionsHttpError carries on `context` rather than in `error.message`.
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message ?? 'Analysis failed.');
  }
  if (!data) {
    throw new Error('The analyzer returned nothing. Try again.');
  }
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

async function readFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      return null;
    }
  }
  return null;
}
