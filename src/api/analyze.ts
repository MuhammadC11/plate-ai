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
  // ImageManipulator creates a pipeline for the local file without changing
  // the original photo selected by the user.
  const context = ImageManipulator.manipulate(uri);
  // A smaller image is faster to upload and is still detailed enough to inspect.
  const rendered = await context.resize({ width: MAX_EDGE }).renderAsync();
  // Base64 is returned because the Edge Function receives the image in JSON.
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
  // Supabase attaches the signed-in user's auth token to this function request.
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
  // A successful HTTP response can still contain no body, so guard that case.
  if (!data) {
    throw new Error('The analyzer returned nothing. Try again.');
  }
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

async function readFunctionError(error: unknown): Promise<string | null> {
  // FunctionsHttpError stores the function's Response under context, not message.
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
