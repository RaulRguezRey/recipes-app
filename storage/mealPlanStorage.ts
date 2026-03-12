import AsyncStorage from '@react-native-async-storage/async-storage';
import { MealPlan, MealPlanEntry } from '../types/Recipe';

const PLANS_KEY = '@mealPlans';
const ENTRIES_KEY = '@mealPlanEntries';

// ─── MealPlans ────────────────────────────────────────────────────────────────

export async function getMealPlans(): Promise<MealPlan[]> {
  const json = await AsyncStorage.getItem(PLANS_KEY);
  return json ? JSON.parse(json) : [];
}

async function savePlans(plans: MealPlan[]): Promise<void> {
  await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export async function saveMealPlan(plan: MealPlan): Promise<void> {
  const plans = await getMealPlans();
  const index = plans.findIndex((p) => p.id === plan.id);
  if (index !== -1) {
    plans[index] = plan;
  } else {
    plans.push(plan);
  }
  await savePlans(plans);
}

export async function deleteMealPlan(id: string): Promise<void> {
  const plans = await getMealPlans();
  await savePlans(plans.filter((p) => p.id !== id));
  // Also delete all entries for this plan
  const entries = await getAllEntries();
  await saveAllEntries(entries.filter((e) => e.mealPlanId !== id));
}

// ─── MealPlanEntries ──────────────────────────────────────────────────────────

async function getAllEntries(): Promise<MealPlanEntry[]> {
  const json = await AsyncStorage.getItem(ENTRIES_KEY);
  return json ? JSON.parse(json) : [];
}

async function saveAllEntries(entries: MealPlanEntry[]): Promise<void> {
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export async function getEntriesForPlan(planId: string): Promise<MealPlanEntry[]> {
  const entries = await getAllEntries();
  return entries.filter((e) => e.mealPlanId === planId);
}

export async function saveEntry(entry: MealPlanEntry): Promise<void> {
  const entries = await getAllEntries();
  const index = entries.findIndex((e) => e.id === entry.id);
  if (index !== -1) {
    entries[index] = entry;
  } else {
    entries.push(entry);
  }
  await saveAllEntries(entries);
}

export async function deleteEntry(id: string): Promise<void> {
  const entries = await getAllEntries();
  await saveAllEntries(entries.filter((e) => e.id !== id));
}

// ─── History helpers ──────────────────────────────────────────────────────────

/**
 * Returns a map of recipeId → ISO weekStart string of the last plan it was used in.
 */
export async function getRecipeLastUsedMap(): Promise<Record<string, string>> {
  const plans = await getMealPlans();
  const entries = await getAllEntries();

  const planWeekMap: Record<string, string> = {};
  for (const p of plans) {
    planWeekMap[p.id] = p.weekStart;
  }

  const result: Record<string, string> = {};
  for (const entry of entries) {
    const weekStart = planWeekMap[entry.mealPlanId];
    if (!weekStart) continue;
    const prev = result[entry.recipeId];
    if (!prev || weekStart > prev) {
      result[entry.recipeId] = weekStart;
    }
  }
  return result;
}
