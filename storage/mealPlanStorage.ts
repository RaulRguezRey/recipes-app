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
    recipeId: row.recipe_id,
    servings: row.servings,
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

export async function saveMealPlan(plan: MealPlan, userId: string): Promise<void> {
  const { error } = await supabase.from('meal_plans').upsert({
    id: plan.id,
    title: plan.title,
    start_date: plan.startDate,
    end_date: plan.endDate,
    created_at: plan.createdAt,
    owner_user_id: userId,
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

export async function saveEntry(entry: MealPlanEntry): Promise<void> {
  const { error } = await supabase.from('meal_plan_entries').upsert({
    id: entry.id,
    meal_plan_id: entry.mealPlanId,
    date: entry.date,
    meal_type: entry.mealType,
    recipe_id: entry.recipeId,
    servings: entry.servings,
  });
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id);
  if (error) throw error;
}

// ── History ───────────────────────────────────────────────────────────────────

/**
 * Returns a map of recipeId → ISO startDate string of the last plan it was used in.
 */
export async function getRecipeLastUsedMap(): Promise<Record<string, string>> {
  const [plans, { data: entriesData, error }] = await Promise.all([
    getMealPlans(),
    supabase.from('meal_plan_entries').select('meal_plan_id, recipe_id'),
  ]);
  if (error) throw error;

  const planDateMap: Record<string, string> = {};
  for (const p of plans) {
    planDateMap[p.id] = p.startDate;
  }

  const result: Record<string, string> = {};
  for (const entry of (entriesData ?? [])) {
    const startDate = planDateMap[entry.meal_plan_id];
    if (!startDate) continue;
    const prev = result[entry.recipe_id];
    if (!prev || startDate > prev) {
      result[entry.recipe_id] = startDate;
    }
  }
  return result;
}
