export type Ingredient = {
  id: string;
  name: string;
  defaultUnit: string;
  category?: string | null;     // sección supermercado: lácteos, verduras…
  isOnline?: boolean;           // true → compra online
  purchaseUrl?: string | null;  // URL directa al producto
  purchaseStore?: string | null; // tienda: carrefour, amazon…
};

export type RecipeIngredient = {
  ingredientId: string;
  quantity: number;
  unit: string;
};

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type Recipe = {
  id: string;
  name: string;
  mealType: MealType;
  origin: string;
  difficulty: Difficulty;
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  caloriesPerServing: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  costEur: number;
  photoUri: string | null;
  isFavorite: boolean;
  sourceUrl?: string | null;  // URL de origen si fue importada de una web
  notes?: string | null;      // notas libres del usuario
  createdAt: string;
  updatedAt: string;
};

// ─── Planning ────────────────────────────────────────────────────────────────

export type DayOfWeek =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

export type MealPlan = {
  id: string;
  title: string;      // ej: "Semana del 10 de marzo"
  weekStart: string;  // ISO date string del lunes (YYYY-MM-DD)
  createdAt: string;
};

export type MealPlanEntry = {
  id: string;
  mealPlanId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  recipeId: string;
  servings: number;
};

// ─── Shopping List ────────────────────────────────────────────────────────────

export type ShoppingListOrigin = {
  recipeId: string;
  recipeName: string;
  servings: number;
};

export type ShoppingListItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string | null;
  isOnline: boolean;
  purchaseUrl?: string | null;
  originRecipes: ShoppingListOrigin[];
  isChecked: boolean;
};

export type ShoppingList = {
  id: string;
  mealPlanId: string;
  createdAt: string;
  items: ShoppingListItem[];
};
