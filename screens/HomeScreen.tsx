import { Flame, Beef, Droplets, Wheat, Sun, Utensils, Coffee, Moon, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getEntriesForPlan, getMealPlans } from '../storage/mealPlanStorage';
import { getRecipes } from '../storage/recipeStorage';
import { DayOfWeek, MealPlan, MealPlanEntry, MealType, Recipe } from '../types/Recipe';
import { C, FONT, RADIUS, SHADOW } from '../constants/theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS: { key: DayOfWeek; short: string }[] = [
  { key: 'monday',    short: 'Lun' },
  { key: 'tuesday',   short: 'Mar' },
  { key: 'wednesday', short: 'Mié' },
  { key: 'thursday',  short: 'Jue' },
  { key: 'friday',    short: 'Vie' },
  { key: 'saturday',  short: 'Sáb' },
  { key: 'sunday',    short: 'Dom' },
];

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

const MEAL_TYPES: { key: MealType; label: string; icon: LucideIcon }[] = [
  { key: 'breakfast', label: 'Desayuno', icon: Sun      },
  { key: 'lunch',     label: 'Almuerzo', icon: Utensils },
  { key: 'snack',     label: 'Merienda', icon: Coffee   },
  { key: 'dinner',    label: 'Cena',     icon: Moon     },
];

const MEAL_BG: Record<MealType, string> = {
  breakfast: '#FFF8F0',
  lunch:     '#F0FFF4',
  snack:     '#F5F0FF',
  dinner:    '#F0F4FF',
};

function todayDayOfWeek(): DayOfWeek {
  const map: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[new Date().getDay()];
}

function greetingText(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatDate(): string {
  return new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Suggestion card ───────────────────────────────────────────────────────────

function SuggestionCard({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  const Icon = MEAL_TYPES.find((m) => m.key === recipe.mealType)?.icon ?? Utensils;
  return (
    <TouchableOpacity style={styles.suggCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.suggBg, { backgroundColor: MEAL_BG[recipe.mealType] }]}>
        <Icon size={22} color={C.primary} strokeWidth={1.8} />
      </View>
      <View style={styles.suggInfo}>
        <Text style={styles.suggName} numberOfLines={2}>{recipe.name}</Text>
        {recipe.caloriesPerServing > 0 && (
          <Text style={styles.suggKcal}>{recipe.caloriesPerServing} kcal</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type Props = { onNavigate: (screen: string) => void };

export default function HomeScreen({ onNavigate }: Props) {
  const { profile } = useAuth();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDayOfWeek());
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [recipeMap, setRecipeMap] = useState<Record<string, Recipe>>({});
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);

  const load = useCallback(async () => {
    const [allPlans, allRecipes] = await Promise.all([getMealPlans(), getRecipes()]);

    const rMap: Record<string, Recipe> = {};
    for (const r of allRecipes) rMap[r.id] = r;
    setRecipeMap(rMap);

    // Suggestions: favorites first, then by newest
    const sorted = [...allRecipes].sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    setSuggestions(sorted.slice(0, 8));

    setPlans(allPlans);
    const latestPlan = allPlans[allPlans.length - 1];
    if (latestPlan) {
      const e = await getEntriesForPlan(latestPlan.id);
      setEntries(e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Macros for selected day
  const dayEntries = entries.filter((e) => e.dayOfWeek === selectedDay);
  const dayMacros = dayEntries.reduce(
    (acc, e) => {
      const r = recipeMap[e.recipeId];
      if (!r) return acc;
      const s = e.servings;
      return {
        kcal:    acc.kcal    + r.caloriesPerServing * s,
        protein: acc.protein + r.proteinG * s,
        fat:     acc.fat     + r.fatG * s,
        carbs:   acc.carbs   + r.carbsG * s,
      };
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const firstName = profile?.display_name?.split(' ')[0] ?? '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greetingText()}{firstName ? `, ${firstName}` : ''}!</Text>
          <Text style={styles.dateText}>{formatDate()}</Text>
        </View>
      </View>

      {/* Macro pills */}
      <View style={styles.macroRow}>
        <View style={[styles.macroCard, { borderTopColor: C.danger }]}>
          <Flame size={16} color={C.danger} strokeWidth={1.8} />
          <Text style={[styles.macroVal, { color: C.danger }]}>{Math.round(dayMacros.kcal)}</Text>
          <Text style={styles.macroLabel}>kcal</Text>
        </View>
        <View style={[styles.macroCard, { borderTopColor: C.info }]}>
          <Beef size={16} color={C.info} strokeWidth={1.8} />
          <Text style={[styles.macroVal, { color: C.info }]}>{dayMacros.protein.toFixed(0)}g</Text>
          <Text style={styles.macroLabel}>Prot.</Text>
        </View>
        <View style={[styles.macroCard, { borderTopColor: C.warning }]}>
          <Droplets size={16} color={C.warning} strokeWidth={1.8} />
          <Text style={[styles.macroVal, { color: C.warning }]}>{dayMacros.fat.toFixed(0)}g</Text>
          <Text style={styles.macroLabel}>Grasas</Text>
        </View>
        <View style={[styles.macroCard, { borderTopColor: C.primary }]}>
          <Wheat size={16} color={C.primary} strokeWidth={1.8} />
          <Text style={[styles.macroVal, { color: C.primary }]}>{dayMacros.carbs.toFixed(0)}g</Text>
          <Text style={styles.macroLabel}>Carbos</Text>
        </View>
      </View>

      {/* Day pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.dayScrollContent}>
        {DAYS.map((d) => {
          const active = d.key === selectedDay;
          return (
            <TouchableOpacity
              key={d.key}
              style={[styles.dayPill, active && styles.dayPillActive]}
              onPress={() => setSelectedDay(d.key)}
            >
              <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{d.short}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Meals of the day */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Comidas del día</Text>
        <TouchableOpacity onPress={() => onNavigate('Planning')}>
          <Text style={styles.sectionLink}>Ver planning</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mealsCard}>
        {MEAL_TYPES.map((mt, idx) => {
          const entry = dayEntries.find((e) => e.mealType === mt.key);
          const recipe = entry ? recipeMap[entry.recipeId] : null;
          const Icon = mt.icon;
          const isLast = idx === MEAL_TYPES.length - 1;
          return (
            <View key={mt.key} style={[styles.mealRow, !isLast && styles.mealRowBorder]}>
              <View style={[styles.mealIconWrap, { backgroundColor: MEAL_BG[mt.key] }]}>
                <Icon size={16} color={C.textSecondary} strokeWidth={1.8} />
              </View>
              <View style={styles.mealInfo}>
                <Text style={styles.mealType}>{mt.label}</Text>
                <Text style={recipe ? styles.mealName : styles.mealEmpty} numberOfLines={1}>
                  {recipe ? recipe.name : 'Sin asignar'}
                </Text>
              </View>
              {recipe && recipe.caloriesPerServing > 0 && (
                <Text style={styles.mealKcal}>{Math.round(recipe.caloriesPerServing * (entry?.servings ?? 1))} kcal</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recetas sugeridas</Text>
            <TouchableOpacity onPress={() => onNavigate('Recipes')}>
              <View style={styles.sectionLinkRow}>
                <Text style={styles.sectionLink}>Ver todas</Text>
                <ChevronRight size={14} color={C.primary} strokeWidth={2} />
              </View>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={suggestions}
            keyExtractor={(r) => r.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggList}
            renderItem={({ item }) => (
              <SuggestionCard recipe={item} onPress={() => onNavigate('Recipes')} />
            )}
          />
        </>
      )}

      {plans.length === 0 && suggestions.length === 0 && (
        <TouchableOpacity style={styles.emptyCard} onPress={() => onNavigate('Recipes')}>
          <Text style={styles.emptyTitle}>¡Empieza añadiendo recetas!</Text>
          <Text style={styles.emptyBody}>Crea tu primer receta y planifica tu semana.</Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPage },
  content: { paddingBottom: 32 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { fontFamily: FONT.serif, fontSize: 22, color: C.textPrimary, fontWeight: '700' },
  dateText: { fontSize: 13, color: C.textMuted, marginTop: 3, textTransform: 'capitalize' },

  macroRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  macroCard: {
    flex: 1,
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 3,
    ...(SHADOW.sm as any),
  },
  macroVal: { fontSize: 16, fontWeight: '700' },
  macroLabel: { fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },

  dayScroll: { marginBottom: 20 },
  dayScrollContent: { paddingHorizontal: 16, gap: 8 },
  dayPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: C.bgSurface,
    ...(SHADOW.sm as any),
  },
  dayPillActive: { backgroundColor: C.primary, ...(SHADOW.activePill as any) },
  dayPillText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  dayPillTextActive: { color: '#fff' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary, fontFamily: FONT.serif },
  sectionLink: { fontSize: 13, color: C.primary, fontWeight: '600' },
  sectionLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  mealsCard: {
    marginHorizontal: 16,
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.lg,
    marginBottom: 24,
    overflow: 'hidden',
    ...(SHADOW.sm as any),
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  mealRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  mealIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealInfo: { flex: 1 },
  mealType: { fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  mealName: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  mealEmpty: { fontSize: 14, color: C.textMuted, fontStyle: 'italic' },
  mealKcal: { fontSize: 13, color: C.danger, fontWeight: '600' },

  suggList: { paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  suggCard: {
    width: 140,
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...(SHADOW.sm as any),
  },
  suggBg: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggInfo: { padding: 10 },
  suggName: { fontSize: 13, fontWeight: '600', color: C.textPrimary, marginBottom: 4 },
  suggKcal: { fontSize: 11, color: C.textMuted },

  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: C.bgCard,
    borderRadius: RADIUS.lg,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontFamily: FONT.serif, fontSize: 17, color: C.textPrimary, fontWeight: '700' },
  emptyBody: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
});
