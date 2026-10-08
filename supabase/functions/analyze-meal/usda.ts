/**
 * Nutrition step. Once the vision model has told us *what* is on the plate and
 * roughly how much it weighs, the actual calorie and macro numbers come from
 * USDA FoodData Central rather than from the model's own guess.
 *
 * All FDC nutrient values in the search response are expressed per 100g, which
 * is why scaling is simply grams / 100.
 *
 * The guiding rule throughout: returning `null` is always better than returning
 * a confident wrong match. A null falls back to the model's estimate, which is
 * tagged in the UI as approximate. A wrong match looks authoritative and can be
 * off by 2-3x -- matching dry rice to a photo of cooked rice, for instance.
 */

const FDC_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

/** FDC nutrient numbers. These are stable identifiers, unlike nutrient names. */
const NUTRIENT = {
  protein: '203',
  fat: '204',
  carbs: '205',
  energyKcal: '208',
  energyAtwaterSpecific: '957',
  energyAtwaterGeneral: '958',
} as const;

/**
 * Analytical and survey data describe generic foods ("chicken breast, roasted")
 * and are what we want for a photo of a home-cooked plate. Branded data covers
 * packaged products and is usually stated as-sold, so a branded "LENTILS" is
 * dry lentils at 219 kcal/100g where the plate holds cooked ones at 116.
 */
const GENERIC_DATA_TYPES = ['Survey (FNDDS)', 'Foundation', 'SR Legacy'];
const BRANDED_DATA_TYPES = ['Branded'];

type FdcNutrient = {
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
};

type FdcFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  foodNutrients?: FdcNutrient[];
};

export type Per100g = {
  fdcId: number;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export class UsdaRateLimitError extends Error {
  constructor() {
    super('USDA rate limit reached (1,000 requests/hour). Try again shortly.');
    this.name = 'UsdaRateLimitError';
  }
}

function nutrientValue(food: FdcFood, numbers: string[], unit?: string): number | null {
  for (const number of numbers) {
    const match = food.foodNutrients?.find(
      (n) => n.nutrientNumber === number && (!unit || n.unitName?.toUpperCase() === unit)
    );
    if (match && typeof match.value === 'number') return match.value;
  }
  return null;
}

function toPer100g(food: FdcFood): Per100g | null {
  const calories = nutrientValue(
    food,
    [NUTRIENT.energyKcal, NUTRIENT.energyAtwaterSpecific, NUTRIENT.energyAtwaterGeneral],
    'KCAL'
  );

  // Some Foundation records carry only micronutrients and no energy value.
  // They are stubs and cannot be scaled meaningfully.
  if (calories === null) return null;

  return {
    fdcId: food.fdcId,
    description: food.description,
    calories,
    protein_g: nutrientValue(food, [NUTRIENT.protein]) ?? 0,
    carbs_g: nutrientValue(food, [NUTRIENT.carbs]) ?? 0,
    fat_g: nutrientValue(food, [NUTRIENT.fat]) ?? 0,
  };
}

const STOPWORDS = new Set(['and', 'or', 'with', 'the', 'a', 'of', 'in', 'ns', 'nfs', 'including']);

/**
 * Preparation state changes calorie density per 100g more than almost anything
 * else, because cooking moves water in or out. Matching "chicken breast,
 * roasted" to a raw record understates it by about a third; matching cooked
 * rice to dry rice overstates it threefold.
 */
const COOKED_WORDS = new Set([
  'cooked', 'roasted', 'baked', 'boiled', 'grilled', 'fried', 'steamed', 'braised',
  'sauteed', 'broiled', 'prepared', 'stewed', 'poached', 'toasted', 'simmered',
]);
const RAW_WORDS = new Set(['raw', 'uncooked', 'dry', 'dried', 'dehydrated', 'unprepared']);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function hasAny(tokens: Iterable<string>, vocabulary: Set<string>): boolean {
  for (const token of tokens) if (vocabulary.has(token)) return true;
  return false;
}

type Scored = {
  food: FdcFood;
  /** Fraction of the query's words present in the description, 0-1. */
  coverage: number;
  score: number;
  /** True when one side says cooked and the other says raw. */
  stateConflict: boolean;
  /** True when the query asks for a cooked food and the match never says so. */
  stateMissing: boolean;
};

function scoreMatch(query: string, description: string, rank: number): Omit<Scored, 'food'> {
  const queryTokens = tokenize(query);
  const descTokens = new Set(tokenize(description));

  if (queryTokens.length === 0) {
    return { coverage: 0, score: 0, stateConflict: false, stateMissing: false };
  }

  const matched = queryTokens.filter((token) => descTokens.has(token)).length;
  const coverage = matched / queryTokens.length;

  const queryCooked = hasAny(queryTokens, COOKED_WORDS);
  const queryRaw = hasAny(queryTokens, RAW_WORDS);
  const descCooked = hasAny(descTokens, COOKED_WORDS);
  const descRaw = hasAny(descTokens, RAW_WORDS);

  const stateConflict = (queryCooked && descRaw) || (queryRaw && descCooked);
  const stateMissing = queryCooked && !descCooked;

  // Extra words in the description mean it is a more specific food than asked
  // for, e.g. "mayonnaise, reduced fat, with olive oil" for "olive oil".
  const bloat = Math.min(Math.max(0, descTokens.size - queryTokens.length) / 20, 0.3);

  // Deliberately small. FDC's own ranking is a tiebreaker, never a reason to
  // accept a match that the word overlap says is wrong.
  const rankBonus = Math.max(0, (10 - rank) / 400);

  let score = coverage - bloat + rankBonus;
  if (stateConflict) score -= 0.5;
  else if (stateMissing) score -= 0.15;

  return { coverage, score, stateConflict, stateMissing };
}

type SearchOutcome =
  | { ok: true; candidates: Scored[] }
  | { ok: false; rateLimited: boolean };

async function searchOnce(
  apiKey: string,
  query: string,
  dataTypes: string[]
): Promise<SearchOutcome> {
  const url = new URL(FDC_SEARCH_URL);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', '10');
  url.searchParams.set('dataType', dataTypes.join(','));
  url.searchParams.set('requireAllWords', 'false');

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    console.error(`FDC request threw for "${query}":`, error);
    return { ok: false, rateLimited: false };
  }

  if (response.status === 429 || response.status === 403) {
    return { ok: false, rateLimited: true };
  }
  if (!response.ok) {
    console.error(`FDC search failed (${response.status}) for "${query}"`);
    return { ok: false, rateLimited: false };
  }

  let payload: { foods?: FdcFood[] };
  try {
    payload = await response.json();
  } catch {
    return { ok: false, rateLimited: false };
  }

  const foods = Array.isArray(payload.foods) ? payload.foods : [];
  return {
    ok: true,
    candidates: foods.map((food, index) => ({
      food,
      ...scoreMatch(query, food.description, index),
    })),
  };
}

/** Minimum word overlap before a generic record is trusted over the model. */
const MIN_GENERIC_COVERAGE = 0.5;
/** Branded records are held to a much higher bar -- see the note above. */
const MIN_BRANDED_COVERAGE = 0.8;

function pick(candidates: Scored[], minCoverage: number, allowStateMissing: boolean): Per100g | null {
  const viable = candidates
    .filter((c) => c.coverage >= minCoverage && !c.stateConflict)
    .filter((c) => allowStateMissing || !c.stateMissing)
    .sort((a, b) => b.score - a.score);

  for (const { food } of viable) {
    const per100g = toPer100g(food);
    if (per100g) return per100g;
  }
  return null;
}

export async function lookupPer100g(apiKey: string, query: string): Promise<Per100g | null> {
  const generic = await searchOnce(apiKey, query, GENERIC_DATA_TYPES);

  if (!generic.ok) {
    if (generic.rateLimited) throw new UsdaRateLimitError();
    // The search errored rather than came back empty. Falling through to
    // Branded here would quietly substitute packaged-product data for a food we
    // never actually failed to find, so stop and let the model estimate stand.
    return null;
  }

  const genericMatch = pick(generic.candidates, MIN_GENERIC_COVERAGE, true);
  if (genericMatch) return genericMatch;

  // Only reach for Branded when the generic datasets genuinely had nothing
  // worth using, and then only for an almost-exact description match that does
  // not contradict the preparation state the query asked for.
  const branded = await searchOnce(apiKey, query, BRANDED_DATA_TYPES);
  if (!branded.ok) {
    if (branded.rateLimited) throw new UsdaRateLimitError();
    return null;
  }

  return pick(branded.candidates, MIN_BRANDED_COVERAGE, false);
}

/** Requests in flight at once. Keeps a single plate well clear of the quota. */
const CONCURRENCY = 4;

export type LookupBatch = {
  results: Map<string, Per100g | null>;
  /** True if the quota ran out partway, so some items fell back to estimates. */
  rateLimited: boolean;
};

/**
 * Looks up many foods at once, de-duplicating repeated queries so a plate with
 * "olive oil" listed twice only costs one request against the hourly quota.
 */
export async function lookupMany(apiKey: string, queries: string[]): Promise<LookupBatch> {
  const unique = [...new Set(queries.map((q) => q.trim().toLowerCase()).filter(Boolean))];
  const results = new Map<string, Per100g | null>();
  let rateLimited = false;
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const query = unique[cursor++];
      if (rateLimited) {
        results.set(query, null);
        continue;
      }
      try {
        results.set(query, await lookupPer100g(apiKey, query));
      } catch (error) {
        if (error instanceof UsdaRateLimitError) {
          // Stop hammering an exhausted quota; the rest fall back to estimates.
          rateLimited = true;
        } else {
          console.error(`FDC lookup threw for "${query}":`, error);
        }
        results.set(query, null);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, unique.length) }, () => worker())
  );

  return { results, rateLimited };
}
