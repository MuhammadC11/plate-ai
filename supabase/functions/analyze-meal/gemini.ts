/**
 * Vision step. Gemini is deliberately *not* asked to be the source of truth for
 * calories -- it is asked to identify foods and estimate portion weight, which
 * is what vision models are actually good at. The macro numbers it returns are
 * only used as a fallback when USDA has no usable match.
 */

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

export type VisionItem = {
  name: string;
  usda_query: string;
  grams: number;
  est_calories: number;
  est_protein_g: number;
  est_carbs_g: number;
  est_fat_g: number;
  confidence: number;
};

export type VisionResult = {
  not_food: boolean;
  title: string;
  notes: string;
  items: VisionItem[];
};

const SYSTEM_PROMPT = `You are a nutrition vision analyst. You are given a photo of a meal and must break it down into its component foods.

PORTION ESTIMATION
- Estimate the edible weight of each component in grams. This is the single most important number you produce.
- Use visible references for scale: a dinner plate is ~26cm across, a side plate ~19cm, a fork ~19cm long, a standard mug ~9cm tall, a chicken breast ~170g, a slice of sandwich bread ~30g, a large egg ~50g.
- Judge depth, not just surface area. A mounded bowl of rice holds far more than a flat layer covering the same circle.
- Report the weight of the food as served and as eaten, not the raw ingredient weight. Cooked rice and pasta roughly triple in weight from dry; meat loses roughly 25% of its weight when cooked.

HIDDEN INGREDIENTS
This is where naive photo estimates fail. Actively account for what you cannot directly see:
- Cooking fat. Anything fried, sauteed, roasted, or glistening carries oil or butter that is invisible but calorie-dense. Add it as its own item (typically 5-15g for a home-cooked portion, more for restaurant food or deep-fried items).
- Dressings, sauces, glazes, marinades, and mayonnaise-based binders in salads and sandwiches.
- Sugar in baked goods, sauces, and glazed or sticky items.
- For mixed, layered, homemade, or ethnic dishes where components are not individually visible, decompose the dish into its typical recipe components and say so in the notes.

SPLITTING
- List each component separately rather than as one combined dish, so portions can be corrected individually.
- Do not list non-caloric items such as water, black coffee, plain tea, ice, or garnishes that will not be eaten.

usda_query
- Write a plain, database-friendly food description: the food, then its preparation. Good: "rice, white, long-grain, cooked". "chicken breast, roasted, skinless". "olive oil". Bad: "Mom's rice", "a pile of chicken", "some oil".
- Do not include brand names, quantities, or adjectives about appearance.

confidence
- 0.9+ when the food is unambiguous and the portion is clearly readable.
- 0.5-0.7 when the food is identifiable but the portion is partly obscured or the depth is a guess.
- Below 0.5 when you are inferring a hidden component or genuinely unsure what the food is.

notes
- One or two short sentences, in plain language, telling the user what you had to guess and what they should check. Mention hidden fat, ambiguous dishes, or obscured portions. Empty string if the plate was genuinely straightforward.

If the photo contains no food, set not_food to true and return an empty items array.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    not_food: { type: 'boolean' },
    title: { type: 'string', description: 'Short name for the whole meal, 2-4 words.' },
    notes: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          usda_query: { type: 'string' },
          grams: { type: 'number' },
          est_calories: { type: 'number' },
          est_protein_g: { type: 'number' },
          est_carbs_g: { type: 'number' },
          est_fat_g: { type: 'number' },
          confidence: { type: 'number' },
        },
        required: [
          'name',
          'usda_query',
          'grams',
          'est_calories',
          'est_protein_g',
          'est_carbs_g',
          'est_fat_g',
          'confidence',
        ],
      },
    },
  },
  required: ['not_food', 'title', 'notes', 'items'],
};

export async function analyzePhoto(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  hint?: string
): Promise<VisionResult> {
  const userText = hint?.trim()
    ? `Analyze this meal photo. The user adds this context, which you should trust over your own reading of the photo: "${hint.trim()}"`
    : 'Analyze this meal photo.';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: userText },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429) {
      throw new Error('Gemini rate limit reached. The free tier resets daily at midnight Pacific.');
    }
    throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 400)}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

  if (!text) {
    const reason = payload?.candidates?.[0]?.finishReason ?? payload?.promptFeedback?.blockReason;
    throw new Error(`Gemini returned no usable content${reason ? ` (${reason})` : ''}.`);
  }

  let parsed: VisionResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini returned malformed JSON.');
  }

  return {
    not_food: Boolean(parsed.not_food),
    title: parsed.title?.trim() || 'Meal',
    notes: parsed.notes?.trim() ?? '',
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}
