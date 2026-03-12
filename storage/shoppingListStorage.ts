import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Ingredient,
  MealPlanEntry,
  Recipe,
  ShoppingList,
  ShoppingListItem,
} from '../types/Recipe';

const LISTS_KEY = '@shoppingLists';

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

  // Accumulator: key = `${ingredientId}|${unit}`
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
    const recipe = recipeMap[entry.recipeId];
    if (!recipe) continue;
    const factor = entry.servings / recipe.servings;

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
        servings: entry.servings,
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

  // Sort: online first, then by name
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

async function getAllLists(): Promise<ShoppingList[]> {
  const json = await AsyncStorage.getItem(LISTS_KEY);
  return json ? JSON.parse(json) : [];
}

async function saveAllLists(lists: ShoppingList[]): Promise<void> {
  await AsyncStorage.setItem(LISTS_KEY, JSON.stringify(lists));
}

export async function getShoppingListForPlan(planId: string): Promise<ShoppingList | null> {
  const lists = await getAllLists();
  // Return the most recent list for this plan
  const planLists = lists.filter((l) => l.mealPlanId === planId);
  if (planLists.length === 0) return null;
  return planLists.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export async function saveShoppingList(list: ShoppingList): Promise<void> {
  const lists = await getAllLists();
  const index = lists.findIndex((l) => l.id === list.id);
  if (index !== -1) {
    lists[index] = list;
  } else {
    lists.push(list);
  }
  await saveAllLists(lists);
}

export async function updateShoppingListItem(
  listId: string,
  itemId: string,
  changes: Partial<ShoppingListItem>
): Promise<void> {
  const lists = await getAllLists();
  const listIndex = lists.findIndex((l) => l.id === listId);
  if (listIndex === -1) return;
  const itemIndex = lists[listIndex].items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) return;
  lists[listIndex].items[itemIndex] = { ...lists[listIndex].items[itemIndex], ...changes };
  await saveAllLists(lists);
}
