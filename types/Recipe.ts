export type Ingredient = {
  id: string;
  name: string;
  defaultUnit: string;
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
  createdAt: string;
  updatedAt: string;
};
