import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAllAccessibleRecipes } from '../storage/recipeStorage';
import { getEntriesForPlan, getMealPlans } from '../storage/mealPlanStorage';
import { MealPlan, MealPlanEntry, Recipe } from '../types/Recipe';
import { C, FONT, RADIUS, SHADOW } from '../constants/theme';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_ABBRS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_FULL  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function generatePlanDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (cur <= end && days.length < 60) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function dateToDayLabel(iso: string): string {
  return DAY_FULL[new Date(iso + 'T00:00:00').getDay()];
}

function dateToDayShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${DAY_ABBRS[d.getDay()]} ${d.getDate()}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DayNutrition = {
  date: string;
  recipes: { name: string; servings: number; kcal: number; protein: number; fat: number; carbs: number; cost: number }[];
  totals: { kcal: number; protein: number; fat: number; carbs: number; cost: number };
};

function calcDayNutrition(date: string, entries: MealPlanEntry[], recipeMap: Record<string, Recipe>): DayNutrition {
  const dayEntries = entries.filter((e) => e.date === date);
  const recipes = dayEntries.map((entry) => {
    const recipe = recipeMap[entry.recipeId];
    if (!recipe) return null;
    const f = entry.servings;
    return {
      name: recipe.name,
      servings: entry.servings,
      kcal: recipe.caloriesPerServing * f,
      protein: recipe.proteinG * f,
      fat: recipe.fatG * f,
      carbs: recipe.carbsG * f,
      cost: recipe.costEur * f,
    };
  }).filter(Boolean) as DayNutrition['recipes'];

  const totals = recipes.reduce(
    (acc, r) => ({
      kcal: acc.kcal + r.kcal,
      protein: acc.protein + r.protein,
      fat: acc.fat + r.fat,
      carbs: acc.carbs + r.carbs,
      cost: acc.cost + r.cost,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0, cost: 0 }
  );

  return { date, recipes, totals };
}

// ── MacroBar ──────────────────────────────────────────────────────────────────

type MacroBarProps = { label: string; value: number; unit: string; color: string };
function MacroBar({ label, value, unit, color }: MacroBarProps) {
  return (
    <View style={styles.macroItem}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={[styles.macroValue, { color }]}>
        {Number.isInteger(value) ? value : value.toFixed(1)}{unit}
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function NutritionScreen({ activePlanId }: { activePlanId: string | null }) {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(activePlanId);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [recipeMap, setRecipeMap] = useState<Record<string, Recipe>>({});
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [allPlans, recipes] = await Promise.all([getMealPlans(), getAllAccessibleRecipes()]);
    setPlans(allPlans);
    const rMap: Record<string, Recipe> = {};
    for (const r of recipes) rMap[r.id] = r;
    setRecipeMap(rMap);

    const planId = currentPlanId ?? allPlans[0]?.id ?? null;
    setCurrentPlanId(planId);
    if (planId) {
      const e = await getEntriesForPlan(planId);
      setEntries(e);
    }
  }, [currentPlanId]);

  useEffect(() => { load(); }, []);

  async function switchPlan(planId: string) {
    setCurrentPlanId(planId);
    const e = await getEntriesForPlan(planId);
    setEntries(e);
  }

  function toggleDay(date: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? null;
  const planDays = currentPlan ? generatePlanDays(currentPlan.startDate, currentPlan.endDate) : [];
  const dayData = planDays.map((d) => calcDayNutrition(d, entries, recipeMap));

  const planTotals = dayData.reduce(
    (acc, d) => ({
      kcal: acc.kcal + d.totals.kcal,
      protein: acc.protein + d.totals.protein,
      fat: acc.fat + d.totals.fat,
      carbs: acc.carbs + d.totals.carbs,
      cost: acc.cost + d.totals.cost,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0, cost: 0 }
  );

  const activeDays = dayData.filter((d) => d.recipes.length > 0).length || 1;
  const avgKcal = planTotals.kcal / activeDays;

  if (!currentPlanId || plans.length === 0) {
    return (
      <View testID="nutrition-empty" style={styles.empty}>
        <Text style={styles.emptyText}>Crea un planning para ver el resumen nutricional.</Text>
      </View>
    );
  }

  return (
    <ScrollView testID="nutrition-scroll" style={styles.container} contentContainerStyle={styles.content}>
      {/* Plan selector */}
      {plans.length > 1 && (
        <ScrollView testID="nutrition-planTabs" horizontal showsHorizontalScrollIndicator={false} style={styles.planTabs}>
          {plans.map((p) => (
            <TouchableOpacity
              key={p.id}
              testID={`nutrition-planTab-${p.id}`}
              style={[styles.planTab, p.id === currentPlanId && styles.planTabActive]}
              onPress={() => switchPlan(p.id)}
            >
              <Text style={[styles.planTabText, p.id === currentPlanId && styles.planTabTextActive]}>
                {p.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Summary card */}
      <View testID="nutrition-summaryCard" style={styles.card}>
        <Text style={styles.cardTitle}>Resumen del planning</Text>
        <View style={styles.macroRow}>
          <MacroBar label="Kcal/día" value={Math.round(avgKcal)} unit="" color={C.danger} />
          <MacroBar label="Proteína" value={Math.round(planTotals.protein)} unit="g" color={C.info} />
          <MacroBar label="Grasas" value={Math.round(planTotals.fat)} unit="g" color={C.warning} />
          <MacroBar label="Carbos" value={Math.round(planTotals.carbs)} unit="g" color={C.primary} />
        </View>
        <View style={styles.costRow}>
          <Text style={styles.costLabel}>Coste estimado total</Text>
          <Text style={styles.costValue}>{planTotals.cost.toFixed(2)} €</Text>
        </View>
      </View>

      {/* Per-day breakdown */}
      {dayData.map(({ date, recipes: dayRecipes, totals }) => (
        <TouchableOpacity
          key={date}
          testID={`nutrition-dayCard-${date}`}
          style={styles.dayCard}
          onPress={() => toggleDay(date)}
          activeOpacity={0.7}
        >
          <View style={styles.dayHeader}>
            <View>
              <Text style={styles.dayLabel}>{dateToDayLabel(date)}</Text>
              <Text style={styles.dayDate}>{dateToDayShort(date)}</Text>
            </View>
            <View style={styles.dayHeaderRight}>
              {totals.kcal > 0 && (
                <Text style={styles.dayKcal}>{Math.round(totals.kcal)} kcal</Text>
              )}
              {totals.cost > 0 && (
                <Text style={styles.dayCost}>{totals.cost.toFixed(2)} €</Text>
              )}
              <Text style={styles.dayChevron}>{expandedDays.has(date) ? '▲' : '▼'}</Text>
            </View>
          </View>
          {expandedDays.has(date) && dayRecipes.length > 0 && (
            <View style={styles.dayDetail}>
              {dayRecipes.map((r, i) => (
                <View key={i} style={styles.dayRecipeRow}>
                  <Text style={styles.dayRecipeName}>{r.name} ×{r.servings}</Text>
                  <Text style={styles.dayRecipeMacros}>
                    {Math.round(r.kcal)} kcal · P {r.protein.toFixed(0)}g · G {r.fat.toFixed(0)}g · C {r.carbs.toFixed(0)}g
                    {r.cost > 0 ? ` · ${r.cost.toFixed(2)}€` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {expandedDays.has(date) && dayRecipes.length === 0 && (
            <Text style={styles.dayEmpty}>Sin recetas este día</Text>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPage },
  content: { padding: 14, gap: 14, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: C.bgPage },
  emptyText: { color: C.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  planTabs: { marginBottom: 10 },
  planTab: { paddingVertical: 9, paddingHorizontal: 16, marginRight: 8, borderRadius: RADIUS.pill, backgroundColor: C.bgSurface, ...(SHADOW.sm as any) },
  planTabActive: { backgroundColor: C.primary, ...(SHADOW.activePill as any) },
  planTabText: { fontSize: 12, color: C.textMuted },
  planTabTextActive: { color: '#fff', fontWeight: '700' },

  card: { backgroundColor: C.bgSurface, borderRadius: RADIUS.lg, padding: 20, ...(SHADOW.sm as any) },
  cardTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary, marginBottom: 18, fontFamily: FONT.serif },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  macroItem: { alignItems: 'center', flex: 1 },
  macroLabel: { fontSize: 11, color: C.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  macroValue: { fontSize: 20, fontWeight: '700' },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingTop: 14 },
  costLabel: { fontSize: 14, color: C.textSecondary },
  costValue: { fontSize: 20, fontWeight: '700', color: C.primary },

  dayCard: { backgroundColor: C.bgSurface, borderRadius: RADIUS.md, overflow: 'hidden', ...(SHADOW.sm as any) },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18 },
  dayLabel: { fontSize: 15, fontWeight: '700', color: C.textPrimary, fontFamily: FONT.serif },
  dayDate: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayKcal: { fontSize: 13, color: C.danger, fontWeight: '600' },
  dayCost: { fontSize: 13, color: C.primary, fontWeight: '600' },
  dayChevron: { fontSize: 11, color: C.textMuted, marginLeft: 4 },
  dayDetail: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingVertical: 14, paddingHorizontal: 18, gap: 10 },
  dayRecipeRow: {},
  dayRecipeName: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  dayRecipeMacros: { fontSize: 12, color: C.textMuted, marginTop: 3 },
  dayEmpty: { paddingVertical: 14, paddingHorizontal: 18, color: C.textMuted, fontSize: 13 },
});
