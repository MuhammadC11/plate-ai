/**
 * How the nutrition numbers for a single item were determined. This is surfaced
 * in the UI so you can tell a database-backed number from a model guess.
 */
export type NutritionSource = 'usda' | 'estimate';

export type MealItem = {
  id: string;
  meal_id: string;
  /** Short label shown in the list, e.g. "Grilled chicken thigh". */
  name: string;
  /** The term actually sent to USDA, e.g. "chicken thigh, grilled, skinless". */
  query: string | null;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: NutritionSource;
  /** USDA FoodData Central id, when the numbers came from the database. */
  fdc_id: number | null;
  /** Model's 0-1 confidence in the portion estimate. */
  confidence: number | null;
  position: number;
};

export type Meal = {
  id: string;
  user_id: string;
  title: string;
  /** Public URL of the stored photo, if one was uploaded. */
  photo_url: string | null;
  /** Anything the model flagged as guessed, hidden, or ambiguous. */
  notes: string | null;
  eaten_at: string;
  created_at: string;
  items: MealItem[];
};

export type Profile = {
  id: string;
  calorie_goal: number;
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
};

export type Totals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

/** Shape returned by the analyze-meal Edge Function. */
export type AnalysisItem = {
  name: string;
  query: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: NutritionSource;
  fdc_id: number | null;
  confidence: number;
};

export type AnalysisResult = {
  title: string;
  items: AnalysisItem[];
  notes: string | null;
  /** True when the photo did not appear to contain food. */
  not_food?: boolean;
};
