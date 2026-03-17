import { Flame, Beef, Droplets, Wheat, Sun, Utensils, Coffee, Moon, ChevronRight, Check, Clock } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getEntriesForPlan, getMealPlans } from '../storage/mealPlanStorage';
import { getAllAccessibleRecipes } from '../storage/recipeStorage';
import { MealPlan, MealPlanEntry, MealType, Recipe } from '../types/Recipe';
import { C, FONT, RADIUS, SHADOW } from '../constants/theme';

// ── Constants ─────────────────────────────────────────────────────────────────

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

const MEAL_TYPES: { key: MealType; label: string; icon: LucideIcon }[] = [
  { key: 'breakfast', label: 'Desayuno', icon: Sun      },
  { key: 'lunch',     label: 'Almuerzo', icon: Utensils },
  { key: 'snack',     label: 'Merienda', icon: Coffee   },
  { key: 'dinner',    label: 'Cena',     icon: Moon     },
];

const MEAL_BG: Record<MealType, string> = {
  breakfast: '#FFF8E1',
  lunch:     '#E8F5E9',
  snack:     '#F3E5F5',
  dinner:    '#FBE9E7',
};

const DAY_ABBRS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function generatePlanDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const cur = new Date(start);
  while (cur <= end && days.length < 60) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function dateToDayAbbr(iso: string): string {
  return DAY_ABBRS[new Date(iso + 'T00:00:00').getDay()];
}

function dateToDayNum(iso: string): number {
  return new Date(iso + 'T00:00:00').getDate();
}

// ── Shared section header ──────────────────────────────────────────────────────

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.secHeader}>
      <Text style={styles.secTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction} style={styles.secActionRow}>
          <Text style={styles.secAction}>{action}</Text>
          <ChevronRight size={12} color={C.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type Props = { onNavigate: (screen: string) => void };

export default function HomeScreen({ onNavigate }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>(todayISODate());
  const [planDays, setPlanDays] = useState<string[]>([]);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [recipeMap, setRecipeMap] = useState<Record<string, Recipe>>({});
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);

  const load = useCallback(async () => {
    const [allPlans, allRecipes] = await Promise.all([getMealPlans(), getAllAccessibleRecipes()]);

    const rMap: Record<string, Recipe> = {};
    for (const r of allRecipes) rMap[r.id] = r;
    setRecipeMap(rMap);

    const sorted = [...allRecipes].sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    setSuggestions(sorted.slice(0, 8));

    setPlans(allPlans);
    const latestPlan = allPlans[0];
    if (latestPlan) {
      const e = await getEntriesForPlan(latestPlan.id);
      setEntries(e);
      const days = generatePlanDays(latestPlan.startDate, latestPlan.endDate);
      setPlanDays(days);
      const today = todayISODate();
      setSelectedDate(today >= latestPlan.startDate && today <= latestPlan.endDate ? today : latestPlan.startDate);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Macros for selected day
  const dayEntries = entries.filter((e) => e.date === selectedDate);
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

  const macros = [
    { icon: Flame,    val: Math.round(dayMacros.kcal),             lbl: 'kcal',     fill: Math.min(100, (dayMacros.kcal / 2000) * 100),    color: '#FF7043' },
    { icon: Beef,     val: Math.round(dayMacros.protein) + 'g',    lbl: 'Proteína', fill: Math.min(100, (dayMacros.protein / 150) * 100),  color: C.info    },
    { icon: Wheat,    val: Math.round(dayMacros.carbs) + 'g',      lbl: 'Carbos',   fill: Math.min(100, (dayMacros.carbs / 200) * 100),    color: C.primary },
    { icon: Droplets, val: Math.round(dayMacros.fat) + 'g',        lbl: 'Grasas',   fill: Math.min(100, (dayMacros.fat / 80) * 100),       color: C.warning },
  ];

  return (
    <ScrollView testID="home-scroll" style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Resumen del día */}
      <SectionHeader title="Resumen del día" action="Ver más" onAction={() => onNavigate('Nutrition')} />
      <View testID="home-macroRow" style={styles.macroRow}>
        {macros.map(({ icon: Icon, val, lbl, fill, color }) => (
          <View key={lbl} testID={`home-macroCard-${lbl}`} style={styles.macroCard}>
            <Icon size={16} color={color} strokeWidth={1.8} />
            <Text style={styles.macroVal}>{val}</Text>
            <Text style={styles.macroLbl}>{lbl}</Text>
            <View style={styles.macroTrack}>
              <View style={[styles.macroFill, { width: `${fill}%` as any, backgroundColor: color }]} />
            </View>
          </View>
        ))}
      </View>

      {/* Plan semanal */}
      <SectionHeader title="Plan semanal" action="Editar" onAction={() => onNavigate('Planning')} />
      <ScrollView testID="home-dayScroll" horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.dayScrollContent}>
        {planDays.map((isoDate) => {
          const active = isoDate === selectedDate;
          return (
            <TouchableOpacity
              key={isoDate}
              testID={`home-dayPill-${isoDate}`}
              style={[styles.dayPill, active && styles.dayPillActive]}
              onPress={() => setSelectedDate(isoDate)}
            >
              <Text style={[styles.dayPillAbbr, active && styles.dayPillAbbrActive]}>{dateToDayAbbr(isoDate).toUpperCase()}</Text>
              <Text style={[styles.dayPillNum, active && styles.dayPillNumActive]}>{dateToDayNum(isoDate)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Comidas de hoy */}
      <SectionHeader title="Comidas de hoy" action="Ver todas" onAction={() => onNavigate('Planning')} />
      <View testID="home-mealsContainer" style={styles.mealsContainer}>
        {MEAL_TYPES.map(({ key, label, icon: Icon }) => {
          const entry = dayEntries.find((e) => e.mealType === key);
          const recipe = entry ? recipeMap[entry.recipeId] : null;
          const kcal = recipe ? Math.round(recipe.caloriesPerServing * (entry?.servings ?? 1)) : 0;
          const prot = recipe ? Math.round(recipe.proteinG * (entry?.servings ?? 1)) : 0;

          return (
            <View key={key} testID={`home-mealRow-${key}`} style={styles.mealRow}>
              {/* Colored icon box */}
              <View style={[styles.mealIconBox, { backgroundColor: MEAL_BG[key] }]}>
                <Icon size={22} color={C.textSecondary} strokeWidth={1.8} />
              </View>
              <View style={styles.mealInfo}>
                <Text style={styles.mealTypeLabel}>{label.toUpperCase()}</Text>
                <Text style={recipe ? styles.mealName : styles.mealEmpty} numberOfLines={1}>
                  {recipe ? recipe.name : 'Sin asignar'}
                </Text>
                {recipe && kcal > 0 && (
                  <View style={styles.mealMacroRow}>
                    <Flame size={9} color='#FF7043' strokeWidth={2} />
                    <Text style={styles.mealMacroText}>{kcal} kcal · {prot}g prot</Text>
                  </View>
                )}
              </View>
              {/* Check circle */}
              <View style={[styles.checkCircle, recipe && styles.checkCircleDone]}>
                {recipe && <Check size={13} color="#fff" strokeWidth={2.5} />}
              </View>
            </View>
          );
        })}
      </View>

      {/* Recetas para ti */}
      {suggestions.length > 0 && (
        <>
          <SectionHeader title="Recetas para ti" action="Ver más" onAction={() => onNavigate('Recipes')} />
          <FlatList
            testID="home-suggestionsList"
            horizontal
            data={suggestions}
            keyExtractor={(r) => r.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggList}
            renderItem={({ item }) => {
              const Icon = MEAL_TYPES.find((m) => m.key === item.mealType)?.icon ?? Utensils;
              const totalTime = item.prepTime + item.cookTime;
              return (
                <TouchableOpacity testID={`home-suggCard-${item.id}`} style={styles.suggCard} onPress={() => onNavigate('Recipes')} activeOpacity={0.85}>
                  <View style={[styles.suggBg, { backgroundColor: MEAL_BG[item.mealType] }]}>
                    <Icon size={38} color={C.textSecondary} strokeWidth={1.4} />
                  </View>
                  <View style={styles.suggInfo}>
                    <Text style={styles.suggName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.suggMeta}>
                      {totalTime > 0 && (
                        <View style={styles.suggMetaItem}>
                          <Clock size={10} color={C.textSecondary} strokeWidth={1.8} />
                          <Text style={styles.suggMetaText}>{totalTime} min</Text>
                        </View>
                      )}
                      {item.caloriesPerServing > 0 && (
                        <View style={styles.suggMetaItem}>
                          <Flame size={10} color='#FF7043' strokeWidth={1.8} />
                          <Text style={styles.suggMetaText}>{item.caloriesPerServing} cal</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      {plans.length === 0 && suggestions.length === 0 && (
        <TouchableOpacity testID="home-emptyCard" style={styles.emptyCard} onPress={() => onNavigate('Recipes')}>
          <Text style={styles.emptyTitle}>¡Empieza añadiendo recetas!</Text>
          <Text style={styles.emptyBody}>Crea tu primera receta y planifica tu semana.</Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPage },
  content: { padding: 20, paddingBottom: 32 },

  // Section header
  secHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  secTitle: { fontFamily: FONT.serif, fontSize: 16, fontWeight: '700', color: C.textPrimary },
  secActionRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  secAction: { fontSize: 11, color: C.primary, fontWeight: '700' },

  // Macro cards
  macroRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  macroCard: {
    flex: 1,
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.md,
    padding: '10px 8px' as any,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
    ...(SHADOW.sm as any),
  },
  macroVal: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  macroLbl: { fontSize: 9, color: C.textSecondary, marginTop: 1 },
  macroTrack: { width: '100%', height: 3, borderRadius: 3, backgroundColor: '#EEE', marginTop: 7, overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: 3 },

  // Day pills
  dayScroll: { marginBottom: 22 },
  dayScrollContent: { gap: 7, paddingVertical: 4 },
  dayPill: {
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayPillActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  dayPillAbbr: { fontSize: 9, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayPillAbbrActive: { color: 'rgba(255,255,255,0.8)' },
  dayPillNum: { fontSize: 15, fontWeight: '700', color: C.textPrimary, marginTop: 2 },
  dayPillNumActive: { color: '#fff' },

  // Meals
  mealsContainer: { gap: 9, marginBottom: 22 },
  mealRow: {
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...(SHADOW.sm as any),
  },
  mealIconBox: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mealInfo: { flex: 1 },
  mealTypeLabel: { fontSize: 10, color: C.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  mealName: { fontSize: 13, fontWeight: '600', color: C.textPrimary, marginTop: 1 },
  mealEmpty: { fontSize: 13, color: C.textMuted, marginTop: 1 },
  mealMacroRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  mealMacroText: { fontSize: 10, color: C.textSecondary },
  checkCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E0E0E0',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkCircleDone: {
    backgroundColor: C.primary,
    ...(SHADOW.activePill as any),
  },

  // Suggestions
  suggList: { gap: 12, paddingBottom: 4 },
  suggCard: { width: 158, backgroundColor: C.bgSurface, borderRadius: RADIUS.xl, overflow: 'hidden', ...(SHADOW.md as any) },
  suggBg: { height: 106, alignItems: 'center', justifyContent: 'center' },
  suggInfo: { padding: '10px 12px 12px' as any, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  suggName: { fontSize: 12, fontWeight: '700', color: C.textPrimary, lineHeight: 16, marginBottom: 7 },
  suggMeta: { flexDirection: 'row', gap: 10 },
  suggMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  suggMetaText: { fontSize: 10, color: C.textSecondary },

  // Empty
  emptyCard: {
    backgroundColor: C.bgCard,
    borderRadius: RADIUS.lg,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontFamily: FONT.serif, fontSize: 17, color: C.textPrimary, fontWeight: '700' },
  emptyBody: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
});
