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
    ingredients: (row.ingredients ?? []).map((ri: any) => ({ ...ri, ingredientId: String(ri.ingredientId) })),
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
    isSeed: row.is_seed ?? false,
    isPublic: row.is_public ?? false,
    ownerUserId: row.owner_user_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recipeToRow(r: Recipe, userId?: string) {
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
    is_public: r.isPublic ?? false,
    created_at: r.createdAt,
    updated_at: new Date().toISOString(),
    ...(userId ? { owner_user_id: userId } : {}),
  };
}

// ── Recipes ──────────────────────────────────────────────────────────────────

export async function getRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('is_seed', false)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(rowToRecipe);
}

// Returns all recipes accessible to the current user (RLS filters for us)
export async function getAllAccessibleRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []).map(rowToRecipe);
}

export async function setRecipePublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .update({ is_public: isPublic })
    .eq('id', id);
  if (error) throw error;
}

export async function addRecipe(recipe: Recipe, userId: string): Promise<void> {
  const { error } = await supabase.from('recipes').insert(recipeToRow(recipe, userId));
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
  // Clean up orphaned ingredients (best-effort — never blocks recipe deletion)
  try {
    const [targetRes, othersRes] = await Promise.all([
      supabase.from('recipes').select('ingredients').eq('id', id).single(),
      supabase.from('recipes').select('ingredients').neq('id', id),
    ]);

    const targetIngIds: string[] = (targetRes.data?.ingredients ?? []).map(
      (ri: any) => String(ri.ingredientId),
    );

    if (targetIngIds.length > 0) {
      const usedElsewhere = new Set<string>(
        (othersRes.data ?? []).flatMap((r: any) =>
          (r.ingredients ?? []).map((ri: any) => String(ri.ingredientId)),
        ),
      );
      const orphanIds = targetIngIds.filter((ingId) => !usedElsewhere.has(ingId));
      if (orphanIds.length > 0) {
        await supabase.from('ingredients').delete().in('id', orphanIds);
      }
    }
  } catch {
    // Ingredient cleanup is non-critical — proceed with recipe deletion regardless
  }

  const { data: deleted, error } = await supabase.from('recipes').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!deleted || deleted.length === 0) throw new Error(`No se pudo borrar la receta. Es posible que las políticas de Supabase (RLS) lo impidan.`);
}

// ── Ingredients ──────────────────────────────────────────────────────────────

export async function getIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase.from('ingredients').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(rowToIngredient);
}

function normalizeIngredientName(name: string): string {
  const t = name.trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export async function addIngredient(ingredient: Ingredient): Promise<void> {
  const normalized = { ...ingredient, name: normalizeIngredientName(ingredient.name) };
  const { error } = await supabase.from('ingredients').insert(ingredientToRow(normalized));
  if (error) throw error;
}

export async function updateIngredient(updated: Ingredient): Promise<void> {
  const normalized = { ...updated, name: normalizeIngredientName(updated.name) };
  const { error } = await supabase
    .from('ingredients')
    .update(ingredientToRow(normalized))
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
