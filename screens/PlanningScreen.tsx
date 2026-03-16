import { Sun, Moon, Coffee, Utensils, ShoppingCart } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getRecipes } from '../storage/recipeStorage';
import {
  deleteMealPlan,
  deleteEntry,
  getEntriesForPlan,
  getMealPlans,
  getRecipeLastUsedMap,
  saveMealPlan,
  saveEntry,
} from '../storage/mealPlanStorage';
import { DayOfWeek, MealPlan, MealPlanEntry, MealType, Recipe } from '../types/Recipe';

import { C, FONT, RADIUS, SHADOW } from '../constants/theme';

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const MEAL_TYPES: { key: MealType; label: string; icon: LucideIcon }[] = [
  { key: 'breakfast', label: 'Desayuno', icon: Sun      },
  { key: 'lunch',     label: 'Almuerzo', icon: Utensils },
  { key: 'snack',     label: 'Merienda', icon: Coffee   },
  { key: 'dinner',    label: 'Cena',     icon: Moon     },
];

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena',
};

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const MEAL_BG: Record<MealType, string> = {
  breakfast: '#FFF8E1',
  lunch:     '#E8F5E9',
  snack:     '#F3E5F5',
  dinner:    '#FBE9E7',
};

function getDayDates(weekStart: string): number[] {
  const monday = new Date(weekStart + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.getDate();
  });
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function weeksAgo(weekStart: string): number {
  const then = new Date(weekStart + 'T00:00:00').getTime();
  const now = new Date().getTime();
  return Math.floor((now - then) / (7 * 24 * 60 * 60 * 1000));
}

// ─── RecipeSelector Modal ─────────────────────────────────────────────────────

type RecipeSelectorProps = {
  visible: boolean;
  recipes: Recipe[];
  lastUsedMap: Record<string, string>;
  currentWeekStart: string;
  currentEntries: MealPlanEntry[];
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
};

function RecipeSelector({
  visible, recipes, lastUsedMap, currentWeekStart, currentEntries, onSelect, onClose,
}: RecipeSelectorProps) {
  const [search, setSearch] = useState('');

  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  function lastUsedLabel(recipeId: string): string {
    const lastWeek = lastUsedMap[recipeId];
    if (!lastWeek) return 'nunca';
    if (lastWeek === currentWeekStart) return 'esta sem.';
    const weeks = weeksAgo(lastWeek);
    return `hace ${weeks} sem.`;
  }

  function handleSelect(recipe: Recipe) {
    const alreadyInPlan = currentEntries.some((e) => e.recipeId === recipe.id);
    if (alreadyInPlan) {
      Alert.alert(
        'Receta ya en el planning',
        `"${recipe.name}" ya está asignada esta semana. ¿Añadir igualmente?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Añadir igualmente', onPress: () => onSelect(recipe) },
        ]
      );
    } else {
      onSelect(recipe);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.selectorOverlay}>
        <View style={styles.selectorCard}>
          <Text style={styles.selectorTitle}>Seleccionar receta</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre…"
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.selectorRow} onPress={() => handleSelect(item)}>
                <View style={styles.selectorRowMain}>
                  <Text style={styles.selectorName}>{item.name}</Text>
                  <Text style={styles.selectorMeta}>
                    {MEAL_TYPE_LABELS[item.mealType]} · {item.prepTime + item.cookTime} min
                    {item.caloriesPerServing ? ` · ${item.caloriesPerServing} kcal` : ''}
                    {item.costEur ? ` · ${item.costEur.toFixed(2)}€` : ''}
                  </Text>
                </View>
                <Text style={styles.selectorLastUsed}>{lastUsedLabel(item.id)}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.selectorEmpty}>No hay recetas</Text>
            }
          />
          <TouchableOpacity style={styles.selectorCancel} onPress={onClose}>
            <Text style={styles.selectorCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Servings Modal ───────────────────────────────────────────────────────────

type ServingsModalProps = {
  visible: boolean;
  entry: MealPlanEntry | null;
  recipeName: string;
  onSave: (servings: number) => void;
  onDelete: () => void;
  onClose: () => void;
};

function ServingsModal({ visible, entry, recipeName, onSave, onDelete, onClose }: ServingsModalProps) {
  const [servings, setServings] = useState('');

  useEffect(() => {
    if (entry) setServings(String(entry.servings));
  }, [entry]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.servOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.servCard} activeOpacity={1}>
          <Text style={styles.servTitle}>{recipeName}</Text>
          <Text style={styles.servLabel}>Raciones</Text>
          <View style={styles.servRow}>
            <TouchableOpacity
              style={styles.servBtn}
              onPress={() => setServings((v) => String(Math.max(1, parseInt(v) - 1)))}
            >
              <Text style={styles.servBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.servInput}
              value={servings}
              onChangeText={setServings}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={styles.servBtn}
              onPress={() => setServings((v) => String(parseInt(v) + 1))}
            >
              <Text style={styles.servBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.servSave}
            onPress={() => onSave(Math.max(1, parseInt(servings) || 1))}
          >
            <Text style={styles.servSaveText}>Guardar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.servDelete} onPress={onDelete}>
            <Text style={styles.servDeleteText}>Eliminar del planning</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Props = {
  onGenerateList: (planId: string) => void;
};

export default function PlanningScreen({ onGenerateList }: Props) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [lastUsedMap, setLastUsedMap] = useState<Record<string, string>>({});

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => {
    const map: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return map[new Date().getDay()];
  });

  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<{ day: DayOfWeek; mealType: MealType } | null>(null);
  const [replacingEntryId, setReplacingEntryId] = useState<string | null>(null);

  const [servingsVisible, setServingsVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);

  const load = useCallback(async () => {
    const [allPlans, allRecipes, luMap] = await Promise.all([
      getMealPlans(),
      getRecipes(),
      getRecipeLastUsedMap(),
    ]);
    setPlans(allPlans);
    setRecipes(allRecipes);
    setLastUsedMap(luMap);
    if (allPlans.length > 0) {
      const current = activePlanId ?? allPlans[allPlans.length - 1].id;
      setActivePlanId(current);
      const planEntries = await getEntriesForPlan(current);
      setEntries(planEntries);
    }
  }, [activePlanId]);

  useEffect(() => { load(); }, []);

  async function switchPlan(planId: string) {
    setActivePlanId(planId);
    const planEntries = await getEntriesForPlan(planId);
    setEntries(planEntries);
  }

  async function createNewPlan() {
    const weekStart = getMondayOfWeek(new Date());
    const label = formatWeekLabel(weekStart);
    const plan: MealPlan = {
      id: newId(),
      title: `Semana del ${label}`,
      weekStart,
      createdAt: new Date().toISOString(),
    };
    await saveMealPlan(plan, user!.id);
    setPlans((prev) => [...prev, plan]);
    await switchPlan(plan.id);
  }

  function openSelector(day: DayOfWeek, mealType: MealType) {
    setSelectorTarget({ day, mealType });
    setSelectorVisible(true);
  }

  function openSelectorForChange(entry: MealPlanEntry) {
    setReplacingEntryId(entry.id);
    setSelectorTarget({ day: entry.dayOfWeek, mealType: entry.mealType });
    setSelectorVisible(true);
  }

  async function handleSelectRecipe(recipe: Recipe) {
    if (!activePlanId || !selectorTarget) return;
    setSelectorVisible(false);

    // If replacing an existing entry, delete it first
    if (replacingEntryId) {
      await deleteEntry(replacingEntryId);
      setEntries((prev) => prev.filter((e) => e.id !== replacingEntryId));
      setReplacingEntryId(null);
    }

    const entry: MealPlanEntry = {
      id: newId(),
      mealPlanId: activePlanId,
      dayOfWeek: selectorTarget.day,
      mealType: selectorTarget.mealType,
      recipeId: recipe.id,
      servings: recipe.servings,
    };
    await saveEntry(entry);
    setEntries((prev) => [...prev, entry]);

    // Update lastUsedMap with current week
    const activePlan = plans.find((p) => p.id === activePlanId);
    if (activePlan) {
      setLastUsedMap((prev) => ({ ...prev, [recipe.id]: activePlan.weekStart }));
    }
  }

  function openServingsModal(entry: MealPlanEntry) {
    setEditingEntry(entry);
    setServingsVisible(true);
  }

  async function handleSaveServings(servings: number) {
    if (!editingEntry) return;
    const updated = { ...editingEntry, servings };
    await saveEntry(updated);
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setServingsVisible(false);
    setEditingEntry(null);
  }

  async function handleDeleteEntry() {
    if (!editingEntry) return;
    await deleteEntry(editingEntry.id);
    setEntries((prev) => prev.filter((e) => e.id !== editingEntry.id));
    setServingsVisible(false);
    setEditingEntry(null);
  }

  const activePlan = plans.find((p) => p.id === activePlanId);
  const dayDates = activePlan ? getDayDates(activePlan.weekStart) : DAYS.map(() => 0);
  const recipeMap: Record<string, Recipe> = {};
  for (const r of recipes) recipeMap[r.id] = r;

  function entriesFor(day: DayOfWeek, mealType: MealType) {
    return entries.filter((e) => e.dayOfWeek === day && e.mealType === mealType);
  }

  if (plans.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay ningún planning creado todavía.</Text>
        <TouchableOpacity style={styles.newPlanBtn} onPress={createNewPlan}>
          <Text style={styles.newPlanBtnText}>+ Nueva semana</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const editingRecipeName = editingEntry ? (recipeMap[editingEntry.recipeId]?.name ?? '') : '';

  // Per-day kcal for weekly summary
  const KCAL_GOAL = 2000;
  const dayKcalValues: Record<DayOfWeek, number> = {} as Record<DayOfWeek, number>;
  for (const { key } of DAYS) {
    dayKcalValues[key] = entries
      .filter((e) => e.dayOfWeek === key)
      .reduce((acc, e) => {
        const r = recipeMap[e.recipeId];
        return r ? acc + r.caloriesPerServing * e.servings : acc;
      }, 0);
  }

  // Kcal for selected day
  const dayKcal = entries
    .filter((e) => e.dayOfWeek === selectedDay)
    .reduce((acc, e) => {
      const r = recipeMap[e.recipeId];
      return r ? acc + r.caloriesPerServing * e.servings : acc;
    }, 0);

  return (
    <View style={styles.container}>
      {/* Plan selector + new plan button */}
      <View style={styles.planBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planTabs} contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8, gap: 8 }}>
          {plans.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.planTab, p.id === activePlanId && styles.planTabActive]}
              onPress={() => switchPlan(p.id)}
            >
              <Text style={[styles.planTabText, p.id === activePlanId && styles.planTabTextActive]}>
                {p.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.newWeekBtn} onPress={createNewPlan}>
          <Text style={styles.newWeekBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Day pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPillsScroll} contentContainerStyle={styles.dayPillsContent}>
        {DAYS.map(({ key: dayKey, label: dayLabel }, idx) => {
          const active = selectedDay === dayKey;
          const shortLabel = dayLabel.slice(0, 3).toUpperCase();
          return (
            <TouchableOpacity
              key={dayKey}
              style={[styles.dayPill, active && styles.dayPillActive]}
              onPress={() => setSelectedDay(dayKey)}
            >
              <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{shortLabel}</Text>
              {dayDates[idx] > 0 && (
                <Text style={[styles.dayPillDate, active && styles.dayPillDateActive]}>{dayDates[idx]}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never">

        {/* Daily kcal box */}
        <View style={styles.kcalBox}>
          <View>
            <Text style={styles.kcalBoxDayName}>{DAYS.find(d => d.key === selectedDay)?.label ?? ''}</Text>
            <Text style={styles.kcalBoxLabel}>Total del día</Text>
          </View>
          <Text style={styles.kcalBoxValue}>{dayKcal > 0 ? `${Math.round(dayKcal)} kcal` : '— kcal'}</Text>
        </View>

        {/* Meal slots for selected day */}
        {MEAL_TYPES.map(({ key: mealType, label: mealLabel, icon: MealIcon }) => {
          const slotEntries = entriesFor(selectedDay, mealType);
          const firstEntry = slotEntries[0] ?? null;
          const recipe = firstEntry ? recipeMap[firstEntry.recipeId] : null;

          return (
            <View key={mealType} style={styles.mealSlot}>
              <View style={styles.mealSlotHeader}>
                <MealIcon size={15} color={C.primary} strokeWidth={1.8} />
                <Text style={styles.mealSlotLabel}>{mealLabel.toUpperCase()}</Text>
                <View style={styles.mealSlotDivider} />
              </View>

              {recipe ? (
                <View style={styles.mealSlotCard}>
                  <View style={[styles.mealSlotIconBox, { backgroundColor: MEAL_BG[mealType] }]}>
                    <MealIcon size={22} color={C.textSecondary} strokeWidth={1.6} />
                  </View>
                  <View style={styles.mealSlotCardInfo}>
                    <Text style={styles.mealSlotName} numberOfLines={1}>{recipe.name}</Text>
                    {recipe.caloriesPerServing > 0 && (
                      <Text style={styles.mealSlotKcal}>
                        🔥 {Math.round(recipe.caloriesPerServing * (firstEntry?.servings ?? 1))} kcal · {firstEntry?.servings} rac.
                      </Text>
                    )}
                  </View>
                  <View style={styles.mealSlotBtns}>
                    <TouchableOpacity
                      style={styles.mealSlotBtnVer}
                      onPress={() => firstEntry && openServingsModal(firstEntry)}
                    >
                      <Text style={styles.mealSlotBtnVerText}>Ver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.mealSlotBtnCambiar}
                      onPress={() => firstEntry && openSelectorForChange(firstEntry)}
                    >
                      <Text style={styles.mealSlotBtnCambiarText}>Cambiar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addSlotBtn}
                  onPress={() => openSelector(selectedDay, mealType)}
                >
                  <Text style={styles.addSlotBtnText}>+ Añadir receta</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Weekly summary bars */}
        {entries.length > 0 && (
          <View style={styles.weekSummary}>
            <Text style={styles.weekSummaryTitle}>Resumen semanal</Text>
            {DAYS.map(({ key: dayKey, label: dayLabel }) => {
              const kcal = dayKcalValues[dayKey];
              const pct = Math.min(1, kcal / KCAL_GOAL);
              const isActive = dayKey === selectedDay;
              return (
                <TouchableOpacity
                  key={dayKey}
                  style={[styles.macroBarRow, isActive && styles.macroBarRowActive]}
                  onPress={() => setSelectedDay(dayKey)}
                >
                  <Text style={[styles.macroBarLabel, isActive && styles.macroBarLabelActive]}>
                    {dayLabel.slice(0, 3)}
                  </Text>
                  <View style={styles.macroBarTrack}>
                    <View style={[styles.macroBarFill, { width: `${pct * 100}%` as any, backgroundColor: isActive ? C.primary : C.textMuted }]} />
                  </View>
                  <Text style={[styles.macroBarVal, isActive && { color: C.primary, fontWeight: '700' }]}>
                    {kcal > 0 ? Math.round(kcal).toString() : '—'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Generate shopping list button */}
        {activePlan && entries.length > 0 && (
          <TouchableOpacity
            style={styles.generateBtn}
            onPress={() => onGenerateList(activePlan.id)}
          >
            <View style={styles.generateBtnContent}>
              <ShoppingCart size={18} color="#fff" strokeWidth={1.8} />
              <Text style={styles.generateBtnText}> Generar lista de la compra</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <RecipeSelector
        visible={selectorVisible}
        recipes={recipes}
        lastUsedMap={lastUsedMap}
        currentWeekStart={activePlan?.weekStart ?? ''}
        currentEntries={entries}
        onSelect={handleSelectRecipe}
        onClose={() => { setSelectorVisible(false); setReplacingEntryId(null); }}
      />

      <ServingsModal
        visible={servingsVisible}
        entry={editingEntry}
        recipeName={editingRecipeName}
        onSave={handleSaveServings}
        onDelete={handleDeleteEntry}
        onClose={() => { setServingsVisible(false); setEditingEntry(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPage },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: C.bgPage },
  emptyText: { color: C.textMuted, fontSize: 16, marginBottom: 28, textAlign: 'center', lineHeight: 24 },
  newPlanBtn: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 16, paddingHorizontal: 36, ...(SHADOW.sm as any) },
  newPlanBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Plan bar
  planBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  planTabs: { flex: 1 },
  planTab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: C.bgPage },
  planTabActive: { backgroundColor: C.primary, ...(SHADOW.activePill as any) },
  planTabText: { color: C.textMuted, fontSize: 12 },
  planTabTextActive: { color: '#fff', fontWeight: '700' },
  newWeekBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  newWeekBtnText: { fontSize: 22, color: C.primary, fontWeight: '300' },

  // Day pills
  dayPillsScroll: { backgroundColor: C.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, height: 72 },
  dayPillsContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'flex-start' },
  dayPill: { width: 56, height: 56, borderRadius: 14, backgroundColor: C.bgPage, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  dayPillActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  dayPillText: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 0.4, lineHeight: 13 },
  dayPillTextActive: { color: C.primary },
  dayPillDate: { fontSize: 15, fontWeight: '700', color: C.textSecondary, marginTop: 2, lineHeight: 17 },
  dayPillDateActive: { color: C.primary },

  // Scroll content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 12, gap: 14 },

  // Daily kcal box
  kcalBox: { backgroundColor: C.primaryLight, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: C.primary + '33' },
  kcalBoxDayName: { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  kcalBoxLabel: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  kcalBoxValue: { fontSize: 22, fontWeight: '700', color: C.primary },

  // Meal slots
  mealSlot: { backgroundColor: C.bgSurface, borderRadius: RADIUS.lg, overflow: 'hidden', ...(SHADOW.sm as any) },
  mealSlotHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  mealSlotLabel: { fontSize: 11, fontWeight: '700', color: C.primary, letterSpacing: 0.6 },
  mealSlotDivider: { flex: 1, height: 1, backgroundColor: C.border },
  mealSlotCard: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  mealSlotIconBox: { width: 50, height: 50, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  mealSlotCardInfo: { flex: 1 },
  mealSlotName: { fontSize: 14, fontWeight: '600', color: C.textPrimary, fontFamily: FONT.serif },
  mealSlotKcal: { fontSize: 12, color: C.textMuted, marginTop: 3 },
  mealSlotBtns: { flexDirection: 'row', gap: 8 },
  mealSlotBtnVer: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: C.primaryLight },
  mealSlotBtnVerText: { fontSize: 12, color: C.primary, fontWeight: '600' },
  mealSlotBtnCambiar: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: '#FFF3E0' },
  mealSlotBtnCambiarText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  addSlotBtn: { marginHorizontal: 14, marginVertical: 12, paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: C.primary + '66', borderStyle: 'dashed' },
  addSlotBtnText: { color: C.primary, fontSize: 14, fontWeight: '600' },

  // Weekly summary
  weekSummary: { backgroundColor: C.bgSurface, borderRadius: RADIUS.lg, padding: 20, ...(SHADOW.sm as any), gap: 10 },
  weekSummaryTitle: { fontSize: 14, fontWeight: '700', color: C.textPrimary, fontFamily: FONT.serif, marginBottom: 4 },
  macroBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 6, borderRadius: RADIUS.sm },
  macroBarRowActive: { backgroundColor: C.primaryLight },
  macroBarLabel: { fontSize: 12, color: C.textSecondary, width: 36 },
  macroBarLabelActive: { color: C.primary, fontWeight: '700' },
  macroBarTrack: { flex: 1, height: 8, backgroundColor: C.bgPage, borderRadius: RADIUS.pill, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: RADIUS.pill },
  macroBarVal: { fontSize: 12, color: C.textMuted, width: 40, textAlign: 'right' },

  // Generate button
  generateBtn: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center', ...(SHADOW.sm as any) },
  generateBtnContent: { flexDirection: 'row', alignItems: 'center' },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Recipe Selector Modal
  selectorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  selectorCard: { backgroundColor: C.bgSurface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '85%' },
  selectorTitle: { fontSize: 17, fontWeight: '700', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, fontFamily: FONT.serif, color: C.textPrimary },
  searchInput: { margin: 14, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.xl, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, backgroundColor: C.bgInput, color: C.textPrimary },
  selectorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  selectorRowMain: { flex: 1 },
  selectorName: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
  selectorMeta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  selectorLastUsed: { fontSize: 12, color: C.primary, marginLeft: 12 },
  selectorEmpty: { textAlign: 'center', color: C.textMuted, padding: 40 },
  selectorCancel: { padding: 18, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  selectorCancelText: { color: C.danger, fontWeight: '600', fontSize: 16 },

  // Servings Modal
  servOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  servCard: { backgroundColor: C.bgSurface, borderRadius: RADIUS.xl, width: '82%', padding: 28, ...(SHADOW.lg as any) },
  servTitle: { fontSize: 16, fontWeight: '700', marginBottom: 20, textAlign: 'center', fontFamily: FONT.serif, color: C.textPrimary },
  servLabel: { fontSize: 14, color: C.textSecondary, marginBottom: 10, textAlign: 'center' },
  servRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  servBtn: { width: 44, height: 44, borderRadius: RADIUS.pill, backgroundColor: C.bgPage, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  servBtnText: { fontSize: 24, color: C.primary, fontWeight: '300' },
  servInput: { width: 64, textAlign: 'center', fontSize: 22, fontWeight: '700', marginHorizontal: 14, borderBottomWidth: 2, borderBottomColor: C.primary, paddingVertical: 4, color: C.textPrimary },
  servSave: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  servSaveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  servDelete: { paddingVertical: 10, alignItems: 'center' },
  servDeleteText: { color: C.danger, fontSize: 14 },
});
