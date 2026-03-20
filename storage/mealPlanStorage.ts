import { supabase } from '../lib/supabase';
import { MealPlan, MealPlanEntry } from '../types/Recipe';

// ── Mappers ──────────────────────────────────────────────────────────────────

function rowToPlan(row: any): MealPlan {
  return {
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  };
}

function rowToEntry(row: any): MealPlanEntry {
  return {
    id: row.id,
    mealPlanId: row.meal_plan_id,
    date: row.date,
    mealType: row.meal_type,
    recipeId: row.recipe_id ?? null,
    servings: row.servings ?? null,
    ingredientId: row.ingredient_id ?? null,
    quantity: row.quantity ?? null,
    unit: row.unit ?? null,
  };
}

// ── MealPlans ─────────────────────────────────────────────────────────────────

export async function getMealPlans(): Promise<MealPlan[]> {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToPlan);
}

export async function saveMealPlan(plan: MealPlan, userId: string, householdId?: string | null): Promise<void> {
  const { error } = await supabase.from('meal_plans').upsert({
    id: plan.id,
    title: plan.title,
    start_date: plan.startDate,
    end_date: plan.endDate,
    week_start: plan.startDate,
    created_at: plan.createdAt,
    owner_user_id: userId,
    ...(householdId ? { household_id: householdId } : {}),
  });
  if (error) throw error;
}

export async function deleteMealPlan(id: string): Promise<void> {
  // ON DELETE CASCADE removes entries and shopping lists automatically
  const { error } = await supabase.from('meal_plans').delete().eq('id', id);
  if (error) throw error;
}

// ── MealPlanEntries ───────────────────────────────────────────────────────────

export async function getEntriesForPlan(planId: string): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('*')
    .eq('meal_plan_id', planId);
  if (error) throw error;
  return (data ?? []).map(rowToEntry);
}

const DAY_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function isoDateToDayOfWeek(isoDate: string): string {
  return DAY_OF_WEEK[new Date(isoDate + 'T00:00:00').getDay()];
}

export async function saveEntry(entry: MealPlanEntry): Promise<void> {
  const { error } = await supabase.from('meal_plan_entries').upsert({
    id: entry.id,
    meal_plan_id: entry.mealPlanId,
    date: entry.date,
    day_of_week: isoDateToDayOfWeek(entry.date),
    meal_type: entry.mealType,
    recipe_id: entry.recipeId ?? null,
    servings: entry.servings ?? null,
    ingredient_id: entry.ingredientId ?? null,
    quantity: entry.quantity ?? null,
    unit: entry.unit ?? null,
  });
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id);
  if (error) throw error;
}

// ── History ───────────────────────────────────────────────────────────────────

/**
 * Returns a map of recipeId → ISO date string of the last entry date for that recipe.
 */
export async function getRecipeLastUsedMap(): Promise<Record<string, string>> {
  const { data: entriesData, error } = await supabase
    .from('meal_plan_entries')
    .select('recipe_id, date');
  if (error) throw error;

  const result: Record<string, string> = {};
  for (const entry of (entriesData ?? [])) {
    if (!entry.recipe_id) continue;
    const prev = result[entry.recipe_id];
    if (!prev || entry.date > prev) {
      result[entry.recipe_id] = entry.date;
    }
  }
  return result;
}

/**
 * Returns the first available plan for the user, or creates a new global plan if none exists.
 */
export async function getOrCreateGlobalPlan(userId: string, householdId?: string | null): Promise<MealPlan> {
  const plans = await getMealPlans();
  if (plans.length > 0) return plans[0];

  const plan: MealPlan = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    title: 'Mi planificación',
    startDate: '2020-01-01',
    endDate: '2099-12-31',
    createdAt: new Date().toISOString(),
  };
  await saveMealPlan(plan, userId, householdId);
  return plan;
}

/**
 * Returns entries for a plan filtered by date range (inclusive).
 */
export async function getEntriesForDateRange(planId: string, startDate: string, endDate: string): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('*')
    .eq('meal_plan_id', planId)
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) throw error;
  return (data ?? []).map(rowToEntry);
}
