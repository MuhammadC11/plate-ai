/**
 * POST /functions/v1/analyze-meal
 *
 * Body: { image_base64: string, mime_type?: string, hint?: string }
 * Returns: AnalysisResult (see src/lib/types.ts in the app)
 *
 * This runs server-side for one reason above all: the Gemini and USDA API keys
 * live here as Supabase secrets and never ship inside the app bundle. Supabase
 * verifies the caller's JWT before this code runs, so only signed-in users can
 * spend your quota.
 */

import { analyzePhoto, type VisionItem } from './gemini.ts';
import { lookupMany, type Per100g } from './usda.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Builds the final numbers for one item. USDA data wins when we found a
 * confident match; otherwise we fall back to the model's own estimate, and the
 * item is tagged so the UI can show that it is less trustworthy.
 */
function resolveItem(item: VisionItem, per100g: Per100g | null) {
  const grams = round(clamp(item.grams, 0, 3000), 1);
  const name = item.name?.trim() || 'Unknown food';
  const confidence = round(clamp(item.confidence, 0, 1), 2);

  if (per100g) {
    const scale = grams / 100;
    return {
      name,
      query: item.usda_query,
      grams,
      calories: round(per100g.calories * scale),
      protein_g: round(per100g.protein_g * scale, 1),
      carbs_g: round(per100g.carbs_g * scale, 1),
      fat_g: round(per100g.fat_g * scale, 1),
      source: 'usda' as const,
      fdc_id: per100g.fdcId,
      confidence,
    };
  }

  const protein = round(clamp(item.est_protein_g, 0, 500), 1);
  const carbs = round(clamp(item.est_carbs_g, 0, 500), 1);
  const fat = round(clamp(item.est_fat_g, 0, 500), 1);
  const stated = clamp(item.est_calories, 0, 5000);

  // Language models are unreliable at arithmetic. When the calorie figure the
  // model stated disagrees badly with the one implied by the macros it stated,
  // the macros are the better bet.
  const implied = protein * 4 + carbs * 4 + fat * 9;
  const disagrees = implied > 0 && Math.abs(stated - implied) / Math.max(implied, 1) > 0.25;

  return {
    name,
    query: item.usda_query,
    grams,
    calories: round(disagrees ? implied : stated),
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    source: 'estimate' as const,
    fdc_id: null,
    confidence,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405);
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const usdaKey = Deno.env.get('USDA_API_KEY');

  if (!geminiKey) {
    return json({ error: 'GEMINI_API_KEY is not set on this Edge Function.' }, 500);
  }

  let body: { image_base64?: string; mime_type?: string; hint?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const imageBase64 = body.image_base64?.replace(/^data:[^;]+;base64,/, '');
  if (!imageBase64) {
    return json({ error: 'image_base64 is required.' }, 400);
  }
  // base64 encodes 3 bytes as 4 characters.
  if (imageBase64.length * 0.75 > MAX_IMAGE_BYTES) {
    return json({ error: 'Image is too large. Resize it before uploading.' }, 413);
  }

  try {
    const vision = await analyzePhoto(
      geminiKey,
      imageBase64,
      body.mime_type ?? 'image/jpeg',
      body.hint
    );

    if (vision.not_food || vision.items.length === 0) {
      return json({
        title: vision.title,
        items: [],
        notes: vision.notes || null,
        not_food: true,
      });
    }

    // Without a USDA key the app still works, just entirely on model estimates.
    const lookup = usdaKey
      ? await lookupMany(usdaKey, vision.items.map((item) => item.usda_query))
      : { results: new Map<string, Per100g | null>(), rateLimited: false };

    const items = vision.items.map((item) =>
      resolveItem(item, lookup.results.get(item.usda_query?.trim().toLowerCase() ?? '') ?? null)
    );

    const extraNotes: string[] = [];
    if (!usdaKey) {
      extraNotes.push('USDA lookup is not configured, so these numbers are model estimates.');
    } else if (lookup.rateLimited) {
      extraNotes.push('The USDA hourly limit was reached, so some items fell back to estimates.');
    }

    const notes = [vision.notes, ...extraNotes].filter(Boolean).join(' ');

    return json({
      title: vision.title,
      items,
      notes: notes || null,
      not_food: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed.';
    console.error('analyze-meal failed:', message);
    return json({ error: message }, 502);
  }
});
