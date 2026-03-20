import { supabase } from '../lib/supabase';
import {
  Ingredient,
  MealPlanEntry,
  Recipe,
  ShoppingList,
  ShoppingListItem,
} from '../types/Recipe';

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Rounding rules (spec §6.3) ───────────────────────────────────────────────

function roundByUnit(qty: number, unit: string): number {
  switch (unit) {
    case 'ud':
      return Math.ceil(qty);
    case 'g':
    case 'ml':
      return Math.round(qty / 5) * 5;
    case 'tsp':
    case 'tbsp':
      return Math.round(qty * 10) / 10;
    default:
      return qty;
  }
}

// ─── Generation (spec §6.1, §6.2, §6.4) ──────────────────────────────────────

export function generateShoppingList(
  mealPlanId: string,
  entries: MealPlanEntry[],
  recipes: Recipe[],
  allIngredients: Ingredient[]
): ShoppingList {
  const recipeMap: Record<string, Recipe> = {};
  for (const r of recipes) recipeMap[r.id] = r;

  const ingredientMap: Record<string, Ingredient> = {};
  for (const i of allIngredients) ingredientMap[i.id] = i;

  type Acc = {
    ingredientId: string;
    name: string;
    unit: string;
    quantity: number;
    origins: ShoppingListItem['originRecipes'];
    isOnline: boolean;
    purchaseUrl?: string | null;
    category?: string | null;
  };
  const acc: Record<string, Acc> = {};

  for (const entry of entries) {
    // Recipe entry
    if (entry.recipeId) {
      const recipe = recipeMap[entry.recipeId];
      if (!recipe) continue;
      const factor = (entry.servings ?? 1) / recipe.servings;

      for (const ri of recipe.ingredients) {
        const ingredient = ingredientMap[ri.ingredientId];
        const name = ingredient?.name ?? ri.ingredientId;
        const key = `${ri.ingredientId}|${ri.unit}`;

        if (!acc[key]) {
          acc[key] = {
            ingredientId: ri.ingredientId,
            name,
            unit: ri.unit,
            quantity: 0,
            origins: [],
            isOnline: ingredient?.isOnline ?? false,
            purchaseUrl: ingredient?.purchaseUrl ?? null,
            category: ingredient?.category ?? null,
          };
        }

        acc[key].quantity += ri.quantity * factor;
        acc[key].origins.push({
          recipeId: entry.recipeId,
          recipeName: recipe.name,
          servings: entry.servings ?? 1,
        });
      }
      continue;
    }

    // Loose ingredient entry
    if (entry.ingredientId && entry.quantity && entry.unit) {
      const ingredient = ingredientMap[entry.ingredientId];
      const name = ingredient?.name ?? entry.ingredientId;
      const key = `${entry.ingredientId}|${entry.unit}`;

      if (!acc[key]) {
        acc[key] = {
          ingredientId: entry.ingredientId,
          name,
          unit: entry.unit,
          quantity: 0,
          origins: [],
          isOnline: ingredient?.isOnline ?? false,
          purchaseUrl: ingredient?.purchaseUrl ?? null,
          category: ingredient?.category ?? null,
        };
      }

      acc[key].quantity += entry.quantity;
      acc[key].origins.push({
        recipeId: '',
        recipeName: 'Ingrediente suelto',
        servings: 1,
      });
    }
  }

  const items: ShoppingListItem[] = Object.values(acc).map((a) => ({
    id: newId(),
    name: a.name,
    quantity: roundByUnit(a.quantity, a.unit),
    unit: a.unit,
    category: a.category,
    isOnline: a.isOnline,
    purchaseUrl: a.purchaseUrl,
    originRecipes: a.origins,
    isChecked: false,
  }));

  items.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    id: newId(),
    mealPlanId,
    createdAt: new Date().toISOString(),
    items,
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function rowToList(row: any): ShoppingList {
  return {
    id: row.id,
    mealPlanId: row.meal_plan_id,
    createdAt: row.created_at,
    items: row.items ?? [],
  };
}

export async function getShoppingListForPlan(planId: string): Promise<ShoppingList | null> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('meal_plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return rowToList(data[0]);
}

export async function saveShoppingList(list: ShoppingList): Promise<void> {
  const { error } = await supabase.from('shopping_lists').upsert({
    id: list.id,
    meal_plan_id: list.mealPlanId,
    created_at: list.createdAt,
    items: list.items,
  });
  if (error) throw error;
}

export async function addItemToShoppingList(
  listId: string,
  item: ShoppingListItem
): Promise<void> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('items')
    .eq('id', listId)
    .single();
  if (error || !data) return;

  const items = [...(data.items as ShoppingListItem[]), item];
  const { error: updateError } = await supabase
    .from('shopping_lists')
    .update({ items })
    .eq('id', listId);
  if (updateError) throw updateError;
}

export async function updateShoppingListItem(
  listId: string,
  itemId: string,
  changes: Partial<ShoppingListItem>
): Promise<void> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('items')
    .eq('id', listId)
    .single();
  if (error || !data) return;

  const items = (data.items as ShoppingListItem[]).map((item) =>
    item.id === itemId ? { ...item, ...changes } : item
  );

  const { error: updateError } = await supabase
    .from('shopping_lists')
    .update({ items })
    .eq('id', listId);
  if (updateError) throw updateError;
}
