import { ChevronLeft, ChevronRight, Sun, Moon, Coffee, Utensils, ShoppingCart } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
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
import { getAllAccessibleRecipes } from '../storage/recipeStorage';
import {
  deleteEntry,
  getEntriesForPlan,
  getMealPlans,
  getRecipeLastUsedMap,
  saveMealPlan,
  saveEntry,
} from '../storage/mealPlanStorage';
import { MealPlan, MealPlanEntry, MealType, Recipe } from '../types/Recipe';

import { C, FONT, RADIUS, SHADOW } from '../constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}


function generatePlanDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const current = new Date(start);
  while (current <= end && days.length < 60) {
    days.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

const DAY_ABBRS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_LABELS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function dateToDayAbbr(isoDate: string): string {
  return DAY_ABBRS[new Date(isoDate + 'T00:00:00').getDay()];
}

function dateToDayNum(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00').getDate();
}

function dateToDayLabel(isoDate: string): string {
  return DAY_LABELS_ES[new Date(isoDate + 'T00:00:00').getDay()];
}

function formatRangeLabel(startDate: string, endDate: string): string {
  const s = new Date(startDate + 'T00:00:00');
  const e = new Date(endDate + 'T00:00:00');
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `Del ${s.getDate()} al ${e.getDate()} de ${MONTH_NAMES[s.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTH_NAMES[s.getMonth()]} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()]}`;
}

function formatDateDisplay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return `${DAY_LABELS_ES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

function daysAgo(isoDate: string): number {
  const then = new Date(isoDate + 'T00:00:00').getTime();
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

const MEAL_BG: Record<MealType, string> = {
  breakfast: '#FFF8E1',
  lunch:     '#E8F5E9',
  snack:     '#F3E5F5',
  dinner:    '#FBE9E7',
};

// ─── Create Plan Modal ────────────────────────────────────────────────────────

type CreatePlanModalProps = {
  visible: boolean;
  onConfirm: (startDate: string, endDate: string, title: string) => void;
  onClose: () => void;
};

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function CreatePlanModal({ visible, onConfirm, onClose }: CreatePlanModalProps) {
  const today = todayISODate();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(() => shiftDate(today, 6));
  const [title, setTitle] = useState('');

  useEffect(() => {
    setTitle(formatRangeLabel(startDate, endDate));
  }, [startDate, endDate]);

  function handleStartChange(days: number) {
    const next = shiftDate(startDate, days);
    setStartDate(next);
    // keep end >= start
    if (endDate < next) setEndDate(next);
  }

  function handleEndChange(days: number) {
    const next = shiftDate(endDate, days);
    if (next < startDate) return;
    setEndDate(next);
  }

  function handleConfirm() {
    onConfirm(startDate, endDate, title.trim() || formatRangeLabel(startDate, endDate));
    const t = todayISODate();
    setStartDate(t);
    setEndDate(shiftDate(t, 6));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.createCard} activeOpacity={1}>
          <Text style={styles.createTitle}>Nueva planificación</Text>

          {/* Start date */}
          <Text style={styles.createLabel}>Fecha de inicio</Text>
          <View style={styles.dateStepper}>
            <TouchableOpacity style={styles.dateArrow} onPress={() => handleStartChange(-1)}>
              <ChevronLeft size={20} color={C.primary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.dateStepperText}>{formatDateDisplay(startDate)}</Text>
            <TouchableOpacity style={styles.dateArrow} onPress={() => handleStartChange(1)}>
              <ChevronRight size={20} color={C.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* End date */}
          <Text style={[styles.createLabel, { marginTop: 16 }]}>Fecha de fin</Text>
          <View style={styles.dateStepper}>
            <TouchableOpacity style={styles.dateArrow} onPress={() => handleEndChange(-1)}>
              <ChevronLeft size={20} color={C.primary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.dateStepperText}>{formatDateDisplay(endDate)}</Text>
            <TouchableOpacity style={styles.dateArrow} onPress={() => handleEndChange(1)}>
              <ChevronRight size={20} color={C.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={[styles.createLabel, { marginTop: 16 }]}>Título</Text>
          <TextInput
            style={styles.createInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Nombre de la planificación"
            placeholderTextColor={C.textMuted}
          />

          <TouchableOpacity style={styles.createConfirmBtn} onPress={handleConfirm}>
            <Text style={styles.createConfirmText}>Crear planificación</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createCancelBtn} onPress={onClose}>
            <Text style={styles.createCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── RecipeSelector Modal ─────────────────────────────────────────────────────

type RecipeSelectorProps = {
  visible: boolean;
  recipes: Recipe[];
  lastUsedMap: Record<string, string>;
  currentStartDate: string;
  currentEntries: MealPlanEntry[];
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
};

function RecipeSelector({
  visible, recipes, lastUsedMap, currentStartDate, currentEntries, onSelect, onClose,
}: RecipeSelectorProps) {
  const [search, setSearch] = useState('');

  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  function lastUsedLabel(recipeId: string): string {
    const lastDate = lastUsedMap[recipeId];
    if (!lastDate) return 'nunca';
    if (lastDate >= currentStartDate) return 'este plan';
    const days = daysAgo(lastDate);
    if (days < 7) return `hace ${days}d`;
    return `hace ${Math.floor(days / 7)} sem.`;
  }

  function handleSelect(recipe: Recipe) {
    const alreadyInPlan = currentEntries.some((e) => e.recipeId === recipe.id);
    if (alreadyInPlan) {
      Alert.alert(
        'Receta ya en el planning',
        `"${recipe.name}" ya está asignada en este planning. ¿Añadir igualmente?`,
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

  const [selectedDate, setSelectedDate] = useState<string>(todayISODate());

  const [createModalVisible, setCreateModalVisible] = useState(false);

  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<{ date: string; mealType: MealType } | null>(null);
  const [replacingEntryId, setReplacingEntryId] = useState<string | null>(null);

  const [servingsVisible, setServingsVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);

  const load = useCallback(async () => {
    const [allPlans, allRecipes, luMap] = await Promise.all([
      getMealPlans(),
      getAllAccessibleRecipes(),
      getRecipeLastUsedMap(),
    ]);
    setPlans(allPlans);
    setRecipes(allRecipes);
    setLastUsedMap(luMap);
    if (allPlans.length > 0) {
      const current = activePlanId ?? allPlans[0].id;
      setActivePlanId(current);
      const planEntries = await getEntriesForPlan(current);
      setEntries(planEntries);
      // Select today if within plan range, else first day
      const plan = allPlans.find((p) => p.id === current) ?? allPlans[0];
      const today = todayISODate();
      setSelectedDate(today >= plan.startDate && today <= plan.endDate ? today : plan.startDate);
    }
  }, [activePlanId]);

  useEffect(() => { load().catch(console.warn); }, []);

  async function switchPlan(planId: string) {
    setActivePlanId(planId);
    const planEntries = await getEntriesForPlan(planId);
    setEntries(planEntries);
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      const today = todayISODate();
      setSelectedDate(today >= plan.startDate && today <= plan.endDate ? today : plan.startDate);
    }
  }

  async function handleCreatePlan(startDate: string, endDate: string, title: string) {
    setCreateModalVisible(false);
    const plan: MealPlan = {
      id: newId(),
      title,
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
    };
    await saveMealPlan(plan, user!.id);
    setPlans((prev) => [plan, ...prev]);
    setActivePlanId(plan.id);
    setEntries([]);
    const today = todayISODate();
    setSelectedDate(today >= startDate && today <= endDate ? today : startDate);
  }

  function openSelector(date: string, mealType: MealType) {
    setSelectorTarget({ date, mealType });
    setSelectorVisible(true);
  }

  function openSelectorForChange(entry: MealPlanEntry) {
    setReplacingEntryId(entry.id);
    setSelectorTarget({ date: entry.date, mealType: entry.mealType });
    setSelectorVisible(true);
  }

  async function handleSelectRecipe(recipe: Recipe) {
    if (!activePlanId || !selectorTarget) return;
    setSelectorVisible(false);

    try {
      if (replacingEntryId) {
        await deleteEntry(replacingEntryId);
        setEntries((prev) => prev.filter((e) => e.id !== replacingEntryId));
        setReplacingEntryId(null);
      }

      const entry: MealPlanEntry = {
        id: newId(),
        mealPlanId: activePlanId,
        date: selectorTarget.date,
        mealType: selectorTarget.mealType,
        recipeId: recipe.id,
        servings: recipe.servings,
      };
      await saveEntry(entry);
      setEntries((prev) => [...prev, entry]);

      const activePlan = plans.find((p) => p.id === activePlanId);
      if (activePlan) {
        setLastUsedMap((prev) => ({ ...prev, [recipe.id]: activePlan.startDate }));
      }
    } catch (err: any) {
      Alert.alert('Error', `No se pudo guardar la receta: ${err?.message ?? err}`);
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
  const planDays = activePlan ? generatePlanDays(activePlan.startDate, activePlan.endDate) : [];
  const recipeMap: Record<string, Recipe> = {};
  for (const r of recipes) recipeMap[r.id] = r;

  function entriesFor(date: string, mealType: MealType) {
    return entries.filter((e) => e.date === date && e.mealType === mealType);
  }

  if (plans.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay ningún planning creado todavía.</Text>
        <TouchableOpacity style={styles.newPlanBtn} onPress={() => setCreateModalVisible(true)}>
          <Text style={styles.newPlanBtnText}>+ Nueva planificación</Text>
        </TouchableOpacity>
        <CreatePlanModal
          visible={createModalVisible}
          onConfirm={handleCreatePlan}
          onClose={() => setCreateModalVisible(false)}
        />
      </View>
    );
  }

  const editingRecipeName = editingEntry ? (recipeMap[editingEntry.recipeId]?.name ?? '') : '';

  const KCAL_GOAL = 2000;

  const dayKcal = entries
    .filter((e) => e.date === selectedDate)
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
        <TouchableOpacity style={styles.newWeekBtn} onPress={() => setCreateModalVisible(true)}>
          <Text style={styles.newWeekBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Day pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPillsScroll} contentContainerStyle={styles.dayPillsContent}>
        {planDays.map((isoDate) => {
          const active = selectedDate === isoDate;
          return (
            <TouchableOpacity
              key={isoDate}
              style={[styles.dayPill, active && styles.dayPillActive]}
              onPress={() => setSelectedDate(isoDate)}
            >
              <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>
                {dateToDayAbbr(isoDate).toUpperCase()}
              </Text>
              <Text style={[styles.dayPillDate, active && styles.dayPillDateActive]}>
                {dateToDayNum(isoDate)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never">

        {/* Daily kcal box */}
        <View style={styles.kcalBox}>
          <View>
            <Text style={styles.kcalBoxDayName}>{dateToDayLabel(selectedDate)}</Text>
            <Text style={styles.kcalBoxLabel}>Total del día</Text>
          </View>
          <Text style={styles.kcalBoxValue}>{dayKcal > 0 ? `${Math.round(dayKcal)} kcal` : '— kcal'}</Text>
        </View>

        {/* Meal slots for selected day */}
        {MEAL_TYPES.map(({ key: mealType, label: mealLabel, icon: MealIcon }) => {
          const slotEntries = entriesFor(selectedDate, mealType);
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
                  onPress={() => openSelector(selectedDate, mealType)}
                >
                  <Text style={styles.addSlotBtnText}>+ Añadir receta</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Planning summary bars */}
        {entries.length > 0 && (
          <View style={styles.weekSummary}>
            <Text style={styles.weekSummaryTitle}>Resumen del planning</Text>
            {planDays.map((isoDate) => {
              const kcal = entries
                .filter((e) => e.date === isoDate)
                .reduce((acc, e) => {
                  const r = recipeMap[e.recipeId];
                  return r ? acc + r.caloriesPerServing * e.servings : acc;
                }, 0);
              const pct = Math.min(1, kcal / KCAL_GOAL);
              const isActive = isoDate === selectedDate;
              return (
                <TouchableOpacity
                  key={isoDate}
                  style={[styles.macroBarRow, isActive && styles.macroBarRowActive]}
                  onPress={() => setSelectedDate(isoDate)}
                >
                  <Text style={[styles.macroBarLabel, isActive && styles.macroBarLabelActive]}>
                    {dateToDayAbbr(isoDate)} {dateToDayNum(isoDate)}
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

      <CreatePlanModal
        visible={createModalVisible}
        onConfirm={handleCreatePlan}
        onClose={() => setCreateModalVisible(false)}
      />

      <RecipeSelector
        visible={selectorVisible}
        recipes={recipes}
        lastUsedMap={lastUsedMap}
        currentStartDate={activePlan?.startDate ?? ''}
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
  planBar: { flexDirection: 'row', alignItems: 'center', height: 56, flexShrink: 0, backgroundColor: C.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
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

  // Planning summary
  weekSummary: { backgroundColor: C.bgSurface, borderRadius: RADIUS.lg, padding: 20, ...(SHADOW.sm as any), gap: 10 },
  weekSummaryTitle: { fontSize: 14, fontWeight: '700', color: C.textPrimary, fontFamily: FONT.serif, marginBottom: 4 },
  macroBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 6, borderRadius: RADIUS.sm },
  macroBarRowActive: { backgroundColor: C.primaryLight },
  macroBarLabel: { fontSize: 12, color: C.textSecondary, width: 46 },
  macroBarLabelActive: { color: C.primary, fontWeight: '700' },
  macroBarTrack: { flex: 1, height: 8, backgroundColor: C.bgPage, borderRadius: RADIUS.pill, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: RADIUS.pill },
  macroBarVal: { fontSize: 12, color: C.textMuted, width: 40, textAlign: 'right' },

  // Generate button
  generateBtn: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center', ...(SHADOW.sm as any) },
  generateBtnContent: { flexDirection: 'row', alignItems: 'center' },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Create Plan Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  createCard: { backgroundColor: C.bgSurface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 24, paddingBottom: 40 },
  createTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, fontFamily: FONT.serif, marginBottom: 20, textAlign: 'center' },
  createLabel: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  dateBtn: { backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14 },
  dateBtnText: { fontSize: 15, color: C.textPrimary, fontWeight: '500' },
  datePicker: { marginTop: 8 },
  createInput: { backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: C.textPrimary },
  dateStepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md },
  dateArrow: { padding: 14 },
  dateStepperText: { flex: 1, textAlign: 'center', fontSize: 15, color: C.textPrimary, fontWeight: '500' },
  createConfirmBtn: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center', marginTop: 24, ...(SHADOW.sm as any) },
  createConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  createCancelBtn: { paddingVertical: 14, alignItems: 'center' },
  createCancelText: { color: C.textMuted, fontSize: 15 },

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
