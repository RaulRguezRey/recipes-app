import { supabase } from '../lib/supabase';
import { Ingredient, Recipe } from '../types/Recipe';

// ── Mappers ──────────────────────────────────────────────────────────────────

function rowToIngredient(row: any): Ingredient {
  return {
    id: row.id,
    name: row.name,
    defaultUnit: row.default_unit,
    category: row.category ?? null,
    isOnline: row.is_online ?? false,
    purchaseUrl: row.purchase_url ?? null,
    purchaseStore: row.purchase_store ?? null,
  };
}

function ingredientToRow(i: Ingredient) {
  return {
    id: i.id,
    name: i.name,
    default_unit: i.defaultUnit,
    category: i.category ?? null,
    is_online: i.isOnline ?? false,
    purchase_url: i.purchaseUrl ?? null,
    purchase_store: i.purchaseStore ?? null,
  };
}

function rowToRecipe(row: any): Recipe {
  return {
    id: row.id,
    name: row.name,
    mealType: row.meal_type,
    origin: row.origin ?? '',
    difficulty: row.difficulty,
    prepTime: row.prep_time,
    cookTime: row.cook_time,
    servings: row.servings,
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    caloriesPerServing: row.calories_per_serving,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    carbsG: row.carbs_g,
    costEur: row.cost_eur,
    photoUri: row.photo_uri ?? null,
    isFavorite: row.is_favorite ?? false,
    sourceUrl: row.source_url ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recipeToRow(r: Recipe) {
  return {
    id: r.id,
    name: r.name,
    meal_type: r.mealType,
    origin: r.origin,
    difficulty: r.difficulty,
    prep_time: r.prepTime,
    cook_time: r.cookTime,
    servings: r.servings,
    ingredients: r.ingredients,
    steps: r.steps,
    calories_per_serving: r.caloriesPerServing,
    protein_g: r.proteinG,
    fat_g: r.fatG,
    carbs_g: r.carbsG,
    cost_eur: r.costEur,
    photo_uri: r.photoUri ?? null,
    is_favorite: r.isFavorite,
    source_url: r.sourceUrl ?? null,
    notes: r.notes ?? null,
    created_at: r.createdAt,
    updated_at: new Date().toISOString(),
  };
}

// ── Recipes ──────────────────────────────────────────────────────────────────

export async function getRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase.from('recipes').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(rowToRecipe);
}

export async function addRecipe(recipe: Recipe): Promise<void> {
  const { error } = await supabase.from('recipes').insert(recipeToRow(recipe));
  if (error) throw error;
}

export async function updateRecipe(updated: Recipe): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .update(recipeToRow(updated))
    .eq('id', updated.id);
  if (error) throw error;
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

// ── Ingredients ──────────────────────────────────────────────────────────────

export async function getIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase.from('ingredients').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(rowToIngredient);
}

export async function addIngredient(ingredient: Ingredient): Promise<void> {
  const { error } = await supabase.from('ingredients').insert(ingredientToRow(ingredient));
  if (error) throw error;
}

export async function updateIngredient(updated: Ingredient): Promise<void> {
  const { error } = await supabase
    .from('ingredients')
    .update(ingredientToRow(updated))
    .eq('id', updated.id);
  if (error) throw error;
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  if (error) throw error;
}

// ── Origins ──────────────────────────────────────────────────────────────────

export async function getOrigins(): Promise<string[]> {
  const { data, error } = await supabase.from('origins').select('name').order('name');
  if (error) throw error;
  return (data ?? []).map((row: any) => row.name as string);
}

export async function addOrigin(origin: string): Promise<void> {
  const normalised = origin.trim();
  if (!normalised) return;
  const { error } = await supabase
    .from('origins')
    .upsert({ name: normalised }, { onConflict: 'name' });
  if (error) throw error;
}
