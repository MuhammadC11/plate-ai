import type { Meal, Totals } from './types';

export const emptyTotals: Totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

export function sumItems(items: { calories: number; protein_g: number; carbs_g: number; fat_g: number }[]): Totals {
  return items.reduce<Totals>(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein_g: acc.protein_g + item.protein_g,
      carbs_g: acc.carbs_g + item.carbs_g,
      fat_g: acc.fat_g + item.fat_g,
    }),
    { ...emptyTotals }
  );
}

export function sumMeals(meals: Meal[]): Totals {
  return sumItems(meals.flatMap((meal) => meal.items));
}

/**
 * Scales an item's nutrition when the user corrects the portion size. The
 * per-gram ratio is held constant, which is what you want for a portion edit
 * (the food didn't change, only how much of it there is).
 */
export function rescaleToGrams<T extends { grams: number; calories: number; protein_g: number; carbs_g: number; fat_g: number }>(
  item: T,
  nextGrams: number
): T {
  if (item.grams <= 0) return { ...item, grams: nextGrams };
  const ratio = nextGrams / item.grams;
  return {
    ...item,
    grams: nextGrams,
    calories: round(item.calories * ratio),
    protein_g: round(item.protein_g * ratio, 1),
    carbs_g: round(item.carbs_g * ratio, 1),
    fat_g: round(item.fat_g * ratio, 1),
  };
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Calories implied by the macros. Comparing this against the reported calorie
 * figure is a cheap sanity check: the two drifting apart by a lot means the
 * portion or the food match is probably wrong.
 */
export function caloriesFromMacros(protein_g: number, carbs_g: number, fat_g: number): number {
  return protein_g * 4 + carbs_g * 4 + fat_g * 9;
}

export function localDayKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfLocalDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfLocalDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatDayLabel(key: string): string {
  const today = localDayKey(new Date());
  const yesterday = localDayKey(new Date(Date.now() - 86_400_000));
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
