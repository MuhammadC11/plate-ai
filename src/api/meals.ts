import { File as FsFile } from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import type { AnalysisItem, Meal, MealItem, Profile } from '@/lib/types';

/**
 * PostgREST returns `numeric` columns as JSON numbers, but coercing defensively
 * keeps arithmetic in the UI safe if a column type ever changes.
 */
function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapItem(row: Record<string, unknown>): MealItem {
  return {
    id: String(row.id),
    meal_id: String(row.meal_id),
    name: String(row.name ?? ''),
    query: (row.query as string | null) ?? null,
    grams: num(row.grams),
    calories: num(row.calories),
    protein_g: num(row.protein_g),
    carbs_g: num(row.carbs_g),
    fat_g: num(row.fat_g),
    source: row.source === 'usda' ? 'usda' : 'estimate',
    fdc_id: row.fdc_id === null || row.fdc_id === undefined ? null : Number(row.fdc_id),
    confidence: row.confidence === null || row.confidence === undefined ? null : num(row.confidence),
    position: num(row.position),
  };
}

function mapMeal(row: Record<string, unknown>): Meal {
  const items = Array.isArray(row.meal_items) ? (row.meal_items as Record<string, unknown>[]) : [];
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title ?? 'Meal'),
    photo_url: (row.photo_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    eaten_at: String(row.eaten_at),
    created_at: String(row.created_at),
    items: items.map(mapItem).sort((a, b) => a.position - b.position),
  };
}

const MEAL_SELECT = 'id, user_id, title, photo_url, notes, eaten_at, created_at, meal_items (*)';

export async function listMealsBetween(start: Date, end: Date): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_SELECT)
    .gte('eaten_at', start.toISOString())
    .lte('eaten_at', end.toISOString())
    .order('eaten_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMeal);
}

export async function listRecentMeals(limit = 60): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_SELECT)
    .order('eaten_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMeal);
}

export async function getMeal(mealId: string): Promise<Meal | null> {
  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_SELECT)
    .eq('id', mealId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapMeal(data) : null;
}

export async function uploadMealPhoto(userId: string, localUri: string): Promise<string | null> {
  try {
    const bytes = await new FsFile(localUri).arrayBuffer();
    const path = `${userId}/${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from('meal-photos')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });

    if (error) throw error;

    return supabase.storage.from('meal-photos').getPublicUrl(path).data.publicUrl;
  } catch (error) {
    // A missing photo should never block logging the meal itself.
    console.warn('Meal photo upload failed:', error);
    return null;
  }
}

export type NewMeal = {
  title: string;
  notes: string | null;
  photoUrl: string | null;
  eatenAt: Date;
  items: AnalysisItem[];
};

export async function createMeal(userId: string, meal: NewMeal): Promise<string> {
  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      title: meal.title,
      notes: meal.notes,
      photo_url: meal.photoUrl,
      eaten_at: meal.eatenAt.toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  const mealId = String(data.id);

  if (meal.items.length > 0) {
    const { error: itemsError } = await supabase.from('meal_items').insert(
      meal.items.map((item, index) => ({
        meal_id: mealId,
        name: item.name,
        query: item.query,
        grams: item.grams,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        source: item.source,
        fdc_id: item.fdc_id,
        confidence: item.confidence,
        position: index,
      }))
    );

    if (itemsError) {
      // Don't leave a meal with no items behind if the second insert fails.
      await supabase.from('meals').delete().eq('id', mealId);
      throw new Error(itemsError.message);
    }
  }

  return mealId;
}

export async function deleteMeal(mealId: string): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', mealId);
  if (error) throw new Error(error.message);
}

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // The signup trigger normally creates this row; this covers accounts made
  // before the trigger existed.
  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId })
      .select('id, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g')
      .single();
    if (insertError) throw new Error(insertError.message);
    return created as Profile;
  }

  return data as Profile;
}

export async function updateProfile(userId: string, patch: Partial<Omit<Profile, 'id'>>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}
