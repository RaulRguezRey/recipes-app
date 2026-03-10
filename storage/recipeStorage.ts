import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ingredient, Recipe } from '../types/Recipe';

const RECIPES_KEY = '@recipes';
const INGREDIENTS_KEY = '@ingredients';

// ─── Recipes ────────────────────────────────────────────────────────────────

export async function getRecipes(): Promise<Recipe[]> {
  const json = await AsyncStorage.getItem(RECIPES_KEY);
  return json ? JSON.parse(json) : [];
}

async function saveRecipes(recipes: Recipe[]): Promise<void> {
  await AsyncStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
}

export async function addRecipe(recipe: Recipe): Promise<void> {
  const recipes = await getRecipes();
  recipes.push(recipe);
  await saveRecipes(recipes);
}

export async function updateRecipe(updated: Recipe): Promise<void> {
  const recipes = await getRecipes();
  const index = recipes.findIndex((r) => r.id === updated.id);
  if (index !== -1) {
    recipes[index] = updated;
    await saveRecipes(recipes);
  }
}

export async function deleteRecipe(id: string): Promise<void> {
  const recipes = await getRecipes();
  await saveRecipes(recipes.filter((r) => r.id !== id));
}

// ─── Ingredients ─────────────────────────────────────────────────────────────

export async function getIngredients(): Promise<Ingredient[]> {
  const json = await AsyncStorage.getItem(INGREDIENTS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function addIngredient(ingredient: Ingredient): Promise<void> {
  const ingredients = await getIngredients();
  const exists = ingredients.some(
    (i) => i.name.toLowerCase() === ingredient.name.toLowerCase()
  );
  if (!exists) {
    ingredients.push(ingredient);
    await AsyncStorage.setItem(INGREDIENTS_KEY, JSON.stringify(ingredients));
  }
}

// ─── Origins ──────────────────────────────────────────────────────────────────

const ORIGINS_KEY = '@origins';

export async function getOrigins(): Promise<string[]> {
  const json = await AsyncStorage.getItem(ORIGINS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function addOrigin(origin: string): Promise<void> {
  const origins = await getOrigins();
  const normalised = origin.trim();
  const exists = origins.some((o) => o.toLowerCase() === normalised.toLowerCase());
  if (!exists) {
    origins.push(normalised);
    await AsyncStorage.setItem(ORIGINS_KEY, JSON.stringify(origins));
  }
}
