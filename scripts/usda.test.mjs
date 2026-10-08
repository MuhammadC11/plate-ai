/**
 * Tests the FoodData Central matching rules with a stubbed `fetch`, using the
 * real FDC response shape. Every case here corresponds to a wrong answer this
 * code produced at some point, so they are regression tests rather than
 * hypotheticals.
 *
 * Run with `npm run test:usda`.
 */
import { lookupPer100g, UsdaRateLimitError } from '../.test-build/usda.js';

// Minimal FDC food record in the real response shape.
function food(fdcId, description, dataType, kcal, p = 0, c = 0, f = 0) {
  const nutrients = [
    { nutrientNumber: '203', unitName: 'G', value: p },
    { nutrientNumber: '204', unitName: 'G', value: f },
    { nutrientNumber: '205', unitName: 'G', value: c },
  ];
  if (kcal !== null) nutrients.push({ nutrientNumber: '208', unitName: 'KCAL', value: kcal });
  return { fdcId, description, dataType, foodNutrients: nutrients };
}

let routes = {};

globalThis.fetch = async (url) => {
  const u = new URL(url);
  const query = u.searchParams.get('query');
  const branded = u.searchParams.get('dataType') === 'Branded';
  const key = `${query}::${branded ? 'branded' : 'generic'}`;
  const route = routes[key];

  if (route === undefined) return { ok: true, status: 200, json: async () => ({ foods: [] }) };
  if (route === 429) return { ok: false, status: 429 };
  if (route === 500) return { ok: false, status: 500 };
  return { ok: true, status: 200, json: async () => ({ foods: route }) };
};

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

test('picks the cooked generic record over the raw one', async () => {
  routes = {
    'chicken breast, roasted, skinless::generic': [
      food(2646170, 'Chicken, breast, boneless, skinless, raw', 'Foundation', 106, 22.5, 0, 1.9),
      food(171477, 'Chicken, breast, roasted, skinless', 'SR Legacy', 165, 31, 0, 3.6),
    ],
  };
  const hit = await lookupPer100g('K', 'chicken breast, roasted, skinless');
  return [hit?.description, hit?.calories === 165];
});

test('rejects a weak match on a mixed dish and returns null', async () => {
  routes = {
    'chicken tikka masala::generic': [
      food(2706087, 'Chicken, chicken roll, roasted', 'Survey (FNDDS)', 164, 16, 3, 9),
      food(1, 'Chicken, stewed', 'SR Legacy', 190, 28, 0, 7),
    ],
  };
  const hit = await lookupPer100g('K', 'chicken tikka masala');
  return [hit === null ? 'null' : hit.description, hit === null];
});

test('does NOT fall back to Branded when the generic search errors', async () => {
  routes = {
    'rice, white, long-grain, cooked::generic': 500,
    'rice, white, long-grain, cooked::branded': [
      food(2545852, 'ORGANIC LONG GRAIN WHITE RICE, LONG GRAIN WHITE', 'Branded', 356, 7, 79, 1),
    ],
  };
  const hit = await lookupPer100g('K', 'rice, white, long-grain, cooked');
  return [hit === null ? 'null' : `${hit.description} @ ${hit.calories}`, hit === null];
});

test('rejects dry Branded lentils for a cooked-lentils query', async () => {
  routes = {
    'lentils, cooked::generic': [],
    'lentils, cooked::branded': [food(1469497, 'LENTILS', 'Branded', 219, 18, 39, 1)],
  };
  const hit = await lookupPer100g('K', 'lentils, cooked');
  return [hit === null ? 'null' : `${hit.description} @ ${hit.calories}`, hit === null];
});

test('rejects dry Branded rice even at high word coverage', async () => {
  routes = {
    'rice, white, long-grain, cooked::generic': [],
    'rice, white, long-grain, cooked::branded': [
      food(2545852, 'ORGANIC LONG GRAIN WHITE RICE, LONG GRAIN WHITE', 'Branded', 356, 7, 79, 1),
    ],
  };
  const hit = await lookupPer100g('K', 'rice, white, long-grain, cooked');
  return [hit === null ? 'null' : `${hit.description} @ ${hit.calories}`, hit === null];
});

test('accepts the correct cooked rice record from generic data', async () => {
  routes = {
    'rice, white, long-grain, cooked::generic': [
      food(2512381, 'Rice, white, long-grain, regular, enriched, cooked', 'SR Legacy', 130, 2.7, 28, 0.3),
    ],
  };
  const hit = await lookupPer100g('K', 'rice, white, long-grain, cooked');
  return [`${hit?.description} @ ${hit?.calories}`, hit?.calories === 130];
});

test('skips a Foundation stub with no energy value', async () => {
  routes = {
    'olive oil::generic': [
      food(2, 'Oil, olive, extra virgin', 'Foundation', null, 0, 0, 100),
      food(3, 'Olive oil', 'Survey (FNDDS)', 900, 0, 0, 100),
    ],
  };
  const hit = await lookupPer100g('K', 'olive oil');
  return [`${hit?.description} @ ${hit?.calories}`, hit?.calories === 900];
});

test('ignores an unrelated high-ranked result for olive oil', async () => {
  routes = {
    'olive oil::generic': [
      food(4, 'Mayonnaise, reduced fat, with olive oil', 'Survey (FNDDS)', 361, 1, 8, 36),
      food(3, 'Olive oil', 'Survey (FNDDS)', 900, 0, 0, 100),
    ],
  };
  const hit = await lookupPer100g('K', 'olive oil');
  return [`${hit?.description} @ ${hit?.calories}`, hit?.calories === 900];
});

test('surfaces a rate limit instead of silently degrading', async () => {
  routes = { 'butter, salted::generic': 429 };
  try {
    await lookupPer100g('K', 'butter, salted');
    return ['no throw', false];
  } catch (e) {
    return [e.constructor.name, e instanceof UsdaRateLimitError];
  }
});

let failures = 0;
for (const [name, fn] of tests) {
  const [detail, passed] = await fn();
  if (!passed) failures += 1;
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}\n      -> ${detail}`);
}
console.log(`\n${tests.length - failures}/${tests.length} passed`);
process.exit(failures ? 1 : 0);
