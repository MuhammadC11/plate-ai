/**
 * Sanity-checks food matching against the real FoodData Central API.
 *
 * Run with `FDC_KEY=your-key npm run check:usda`. Without a key it uses
 * DEMO_KEY, which allows only 30 requests per hour.
 */
import { lookupPer100g } from '../.test-build/usda.js';

// Reference values are per 100g from published USDA figures, used here only to
// eyeball whether the match is sane.
const cases = [
  ['rice, white, long-grain, cooked', 130],
  ['chicken breast, roasted, skinless', 165],
  ['olive oil', 884],
  ['chicken tikka masala', null],
];

for (const [query, expected] of cases) {
  try {
    const hit = await lookupPer100g(process.env.FDC_KEY ?? 'DEMO_KEY', query);
    if (!hit) {
      console.log(`null    ${query.padEnd(36)} (expected ${expected ?? 'null / model estimate'})`);
      continue;
    }
    const delta = expected ? ` [ref ${expected}, off by ${Math.round(Math.abs(hit.calories - expected) / expected * 100)}%]` : ' [expected null!]';
    console.log(`${String(Math.round(hit.calories)).padStart(4)}    ${query.padEnd(36)} ${hit.description}${delta}`);
  } catch (e) {
    console.log(`ERROR   ${query.padEnd(36)} ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 1200));
}
