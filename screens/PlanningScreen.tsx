import { ChevronLeft, ChevronRight, Sun, Moon, Coffee, Utensils, ShoppingCart, Flame } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addIngredient, getAllAccessibleRecipes, getIngredients } from '../storage/recipeStorage';
import RecipeDetailModal from '../components/RecipeDetailModal';
import ShoppingListScreen from './ShoppingListScreen';
import {
  deleteEntry,
  getEntriesForPlan,
  getOrCreateGlobalPlan,
  getRecipeLastUsedMap,
  saveEntry,
} from '../storage/mealPlanStorage';
import { Ingredient, MealPlan, MealPlanEntry, MealType, Recipe } from '../types/Recipe';

import { C, FONT, RADIUS, SHADOW } from '../constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISODate(): string {
  return localISODate(new Date());
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localISODate(d);
}

function getWeekDays(offset: number): string[] {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localISODate(d);
  });
}

function getWeekLabel(offset: number): string {
  const days = getWeekDays(offset);
  const start = new Date(days[0] + 'T00:00:00');
  const end = new Date(days[6] + 'T00:00:00');
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} – ${end.getDate()} de ${MONTH_NAMES[start.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3)}`;
}

function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return `${DAY_ABBRS[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
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

function daysAgo(isoDate: string): number {
  const then = new Date(isoDate + 'T00:00:00').getTime();
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

// ─── Month calendar helpers ───────────────────────────────────────────────────

const MONTH_CALENDAR_HEIGHT = 240;

/** Returns an array of 5 weeks (35 days) centered around the given selectedDate */
function getMonthGridDays(selectedDate: string): string[] {
  const today = new Date(selectedDate + 'T00:00:00');
  // Go back to the monday of the previous week
  const dow = today.getDay(); // 0=Sun
  const mondayThisWeek = new Date(today);
  mondayThisWeek.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const startMonday = new Date(mondayThisWeek);
  startMonday.setDate(mondayThisWeek.getDate() - 7); // previous week
  return Array.from({ length: 35 }, (_, i) => {
    const d = new Date(startMonday);
    d.setDate(startMonday.getDate() + i);
    return localISODate(d);
  });
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

const MEAL_PICKER_BG: Record<MealType, string> = {
  breakfast: '#FFF3CD',
  lunch:     '#D4EDDA',
  snack:     '#E8D5F5',
  dinner:    '#FFD9CC',
};
const MEAL_PICKER_TEXT: Record<MealType, string> = {
  breakfast: '#7B5800',
  lunch:     '#1B5E20',
  snack:     '#4A148C',
  dinner:    '#8B2500',
};

// ─── RecipeSelector Modal ─────────────────────────────────────────────────────

const ING_UNITS = ['ud', 'g', 'ml', 'tsp', 'tbsp', 'kg', 'l'];

type RecipeSelectorProps = {
  visible: boolean;
  recipes: Recipe[];
  lastUsedMap: Record<string, string>;
  currentWeekStart: string;
  currentEntries: MealPlanEntry[];
  ingredients: Ingredient[];
  onSelect: (recipe: Recipe, servings: number) => void;
  onAddLooseIngredient: (ingredientId: string | null, name: string, qty: number, unit: string) => void;
  onClose: () => void;
};

function RecipeSelector({
  visible, recipes, lastUsedMap, currentWeekStart, currentEntries,
  ingredients, onSelect, onAddLooseIngredient, onClose,
}: RecipeSelectorProps) {
  const [tab, setTab] = useState<'recipes' | 'ingredient'>('recipes');

  // Recipe tab state
  const [search, setSearch] = useState('');
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null);
  const [pendingServings, setPendingServings] = useState(1);

  // Ingredient tab state
  const [ingName, setIngName] = useState('');
  const [ingQty, setIngQty] = useState('1');
  const [ingUnit, setIngUnit] = useState('ud');
  const [ingSelectedId, setIngSelectedId] = useState<string | null>(null);
  const [ingShowUnitPicker, setIngShowUnitPicker] = useState(false);

  function normalize(s: string) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  const filtered = recipes.filter((r) =>
    normalize(r.name).includes(normalize(search))
  );

  const ingSuggestion =
    ingName.trim().length > 0
      ? ingredients.find(
          (i) =>
            i.name.toLowerCase().startsWith(ingName.trim().toLowerCase()) &&
            i.name.toLowerCase() !== ingName.trim().toLowerCase()
        )
      : undefined;

  function lastUsedLabel(recipeId: string): string {
    const lastDate = lastUsedMap[recipeId];
    if (!lastDate) return 'nunca';
    if (lastDate >= currentWeekStart) return 'esta semana';
    const days = daysAgo(lastDate);
    if (days < 7) return `hace ${days}d`;
    return `hace ${Math.floor(days / 7)} sem.`;
  }

  function handleTapRecipe(recipe: Recipe) {
    setPendingRecipe(recipe);
    setPendingServings(recipe.servings > 0 ? recipe.servings : 1);
  }

  function handleConfirm() {
    if (!pendingRecipe) return;
    const alreadyInPlan = currentEntries.some((e) => e.recipeId === pendingRecipe.id);
    if (alreadyInPlan) {
      Alert.alert(
        'Receta ya en el planning',
        `"${pendingRecipe.name}" ya está asignada en este planning. ¿Añadir igualmente?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Añadir igualmente', onPress: () => onSelect(pendingRecipe, pendingServings) },
        ]
      );
    } else {
      onSelect(pendingRecipe, pendingServings);
    }
  }

  function handleIngConfirm() {
    const trimmed = ingName.trim();
    if (!trimmed) return;
    const qty = parseFloat(ingQty);
    if (!qty || qty <= 0) return;
    const exactMatch = ingredients.find((i) => i.name.toLowerCase() === trimmed.toLowerCase());
    const resolvedId = ingSelectedId ?? exactMatch?.id ?? null;
    onAddLooseIngredient(resolvedId, trimmed, qty, ingUnit);
    handleClose();
  }

  function handleClose() {
    setPendingRecipe(null);
    setSearch('');
    setTab('recipes');
    setIngName('');
    setIngQty('1');
    setIngUnit('ud');
    setIngSelectedId(null);
    setIngShowUnitPicker(false);
    onClose();
  }

  return (
    <Modal testID="planning-recipeSelector" visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.selectorOverlay}>
        <View style={styles.selectorCard}>

          {/* Tab bar */}
          <View style={styles.selectorTabBar}>
            <TouchableOpacity
              style={[styles.selectorTab, tab === 'recipes' && styles.selectorTabActive]}
              onPress={() => setTab('recipes')}
            >
              <Text style={[styles.selectorTabText, tab === 'recipes' && styles.selectorTabTextActive]}>Receta</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectorTab, tab === 'ingredient' && styles.selectorTabActive]}
              onPress={() => setTab('ingredient')}
            >
              <Text style={[styles.selectorTabText, tab === 'ingredient' && styles.selectorTabTextActive]}>Ingrediente</Text>
            </TouchableOpacity>
          </View>

          {tab === 'recipes' ? (
            <>
              <TextInput
                testID="planning-recipeSelectorSearch"
                style={styles.searchInput}
                placeholder="Buscar por nombre…"
                value={search}
                onChangeText={setSearch}
              />
              <FlatList
                testID="planning-recipeSelectorList"
                data={filtered}
                keyExtractor={(r) => r.id}
                renderItem={({ item }) => {
                  const isPending = pendingRecipe?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.selectorRow, isPending && styles.selectorRowPending]}
                      onPress={() => handleTapRecipe(item)}
                    >
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
                  );
                }}
                ListEmptyComponent={<Text style={styles.selectorEmpty}>No hay recetas</Text>}
              />
              {pendingRecipe && (
                <View style={styles.selectorServingsPanel}>
                  <Text style={styles.selectorServingsName} numberOfLines={1}>{pendingRecipe.name}</Text>
                  <View style={styles.selectorServingsRow}>
                    <Text style={styles.selectorServingsLabel}>Raciones:</Text>
                    <TouchableOpacity style={styles.selectorServingsBtn} onPress={() => setPendingServings((v) => Math.max(1, v - 1))}>
                      <Text style={styles.selectorServingsBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.selectorServingsVal}>{pendingServings}</Text>
                    <TouchableOpacity style={styles.selectorServingsBtn} onPress={() => setPendingServings((v) => v + 1)}>
                      <Text style={styles.selectorServingsBtnText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.selectorServingsConfirm} onPress={handleConfirm}>
                      <Text style={styles.selectorServingsConfirmText}>Añadir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.ingTabContent}>
              {/* Name input (fixed at top, same height as recipe search) */}
              <TextInput
                style={styles.searchInput}
                placeholder="Nombre del ingrediente…"
                value={ingName}
                onChangeText={(t) => { setIngName(t); setIngSelectedId(null); }}
                autoFocus={tab === 'ingredient'}
              />
              {ingSuggestion && (
                <TouchableOpacity
                  style={styles.ingTabSuggestion}
                  onPress={() => { setIngName(ingSuggestion.name); setIngSelectedId(ingSuggestion.id); setIngUnit(ingSuggestion.defaultUnit ?? 'ud'); }}
                >
                  <Text style={styles.ingTabSuggestionText}>{ingSuggestion.name}</Text>
                </TouchableOpacity>
              )}

              {/* Quantity + Unit */}
              <View style={styles.ingTabQtyRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.ingTabLabel}>CANTIDAD</Text>
                  <TextInput
                    style={[styles.searchInput, { marginHorizontal: 0 }]}
                    placeholder="1"
                    value={ingQty}
                    onChangeText={setIngQty}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ingTabLabel}>UNIDAD</Text>
                  <TouchableOpacity
                    style={[styles.searchInput, styles.ingTabUnitBtn, { marginHorizontal: 0 }]}
                    onPress={() => setIngShowUnitPicker((v) => !v)}
                  >
                    <Text style={styles.ingTabUnitBtnText}>{ingUnit}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {ingShowUnitPicker && (
                <View style={styles.ingTabUnitPicker}>
                  {ING_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.ingTabUnitOption, u === ingUnit && styles.ingTabUnitOptionActive]}
                      onPress={() => { setIngUnit(u); setIngShowUnitPicker(false); }}
                    >
                      <Text style={[styles.ingTabUnitOptionText, u === ingUnit && styles.ingTabUnitOptionTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.selectorServingsConfirm, styles.ingTabConfirmBtn, (!ingName.trim() || !parseFloat(ingQty)) && { opacity: 0.4 }]}
                onPress={handleIngConfirm}
                disabled={!ingName.trim() || !parseFloat(ingQty)}
              >
                <Text style={styles.selectorServingsConfirmText}>Añadir ingrediente</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.selectorCancel} onPress={handleClose}>
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
    if (entry) setServings(String(entry.servings ?? 1));
  }, [entry]);

  return (
    <Modal testID="planning-servingsModal" visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
            testID="planning-servingsSaveBtn"
            style={styles.servSave}
            onPress={() => onSave(Math.max(1, parseInt(servings) || 1))}
          >
            <Text style={styles.servSaveText}>Guardar</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="planning-servingsDeleteBtn" style={styles.servDelete} onPress={onDelete}>
            <Text style={styles.servDeleteText}>Eliminar del planning</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Drag constants ───────────────────────────────────────────────────────────

const DRAG_ACTIVATE_MS = 800;
const DRAG_CARD_WIDTH = 280;

// ─── DraggableRecipeCard ──────────────────────────────────────────────────────

type DraggableRecipeCardProps = {
  entry: MealPlanEntry;
  recipe: Recipe;
  mealType: MealType;
  MealIcon: LucideIcon;
  isDragSource: boolean;
  onTap: () => void;
  onEditServings: () => void;
  onChangeMeal: () => void;
  onDragStart: (entry: MealPlanEntry, recipe: Recipe, pageX: number, pageY: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (pageX: number, pageY: number) => void;
  onDragCancel: () => void;
  onScrollEnable: (enabled: boolean) => void;
};

function DraggableRecipeCard({
  entry, recipe, mealType, MealIcon, isDragSource,
  onTap, onEditServings, onChangeMeal,
  onDragStart, onDragMove, onDragEnd, onDragCancel, onScrollEnable,
}: DraggableRecipeCardProps) {
  const longPressActive = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fingerPos = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const entryRef = useRef(entry);
  const recipeRef = useRef(recipe);
  useEffect(() => { entryRef.current = entry; recipeRef.current = recipe; });
  const cbRefs = useRef({ onTap, onEditServings, onChangeMeal, onDragStart, onDragMove, onDragEnd, onDragCancel, onScrollEnable });
  useEffect(() => {
    cbRefs.current = { onTap, onEditServings, onChangeMeal, onDragStart, onDragMove, onDragEnd, onDragCancel, onScrollEnable };
  });

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => longPressActive.current,
    onPanResponderGrant: (e) => {
      longPressActive.current = false;
      startPos.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      fingerPos.current = { ...startPos.current };
      // Disable ScrollView immediately so it can't steal the gesture
      cbRefs.current.onScrollEnable(false);
      longPressTimer.current = setTimeout(() => {
        longPressActive.current = true;
        cbRefs.current.onDragStart(
          entryRef.current, recipeRef.current,
          fingerPos.current.x, fingerPos.current.y,
        );
      }, DRAG_ACTIVATE_MS);
    },
    onPanResponderMove: (e) => {
      const { pageX, pageY } = e.nativeEvent;
      fingerPos.current = { x: pageX, y: pageY };
      if (!longPressActive.current) {
        if (Math.abs(pageX - startPos.current.x) > 10 || Math.abs(pageY - startPos.current.y) > 10) {
          if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        }
        return;
      }
      cbRefs.current.onDragMove(pageX, pageY);
    },
    onPanResponderRelease: (e) => {
      cbRefs.current.onScrollEnable(true);
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (longPressActive.current) {
        longPressActive.current = false;
        cbRefs.current.onDragEnd(e.nativeEvent.pageX, e.nativeEvent.pageY);
      } else {
        cbRefs.current.onTap();
      }
    },
    onPanResponderTerminate: () => {
      cbRefs.current.onScrollEnable(true);
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (longPressActive.current) {
        longPressActive.current = false;
        cbRefs.current.onDragCancel();
      }
    },
  })).current;

  return (
    <View style={[styles.mealSlotCard, isDragSource && styles.mealSlotCardDragging]} {...panResponder.panHandlers}>
      <View style={styles.mealSlotTapArea}>
        <View style={[styles.mealSlotIconBox, { backgroundColor: MEAL_BG[mealType] }]}>
          <MealIcon size={22} color={C.textSecondary} strokeWidth={1.6} />
        </View>
        <View style={styles.mealSlotCardInfo}>
          <Text style={styles.mealSlotName} numberOfLines={1}>{recipe.name}</Text>
          {recipe.caloriesPerServing > 0 && (
            <View style={styles.mealSlotKcalRow}>
              <Flame size={11} color="#FF7043" strokeWidth={1.8} />
              <Text style={styles.mealSlotKcal}> {Math.round(recipe.caloriesPerServing * (entry.servings ?? 1))} kcal · {entry.servings} rac.</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.mealSlotBtns}>
        <TouchableOpacity style={styles.mealSlotBtnVer} onPress={onEditServings}>
          <Text style={styles.mealSlotBtnVerText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mealSlotBtnCambiar} onPress={onChangeMeal}>
          <Text style={styles.mealSlotBtnCambiarText}>Cambiar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PlanningScreen() {
  const { user, household } = useAuth();
  const [globalPlan, setGlobalPlan] = useState<MealPlan | null>(null);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [lastUsedMap, setLastUsedMap] = useState<Record<string, string>>({});
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [dragEntry, setDragEntry] = useState<MealPlanEntry | null>(null);
  const [dragRecipe, setDragRecipe] = useState<Recipe | null>(null);
  const dragAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [mealPickerDay, setMealPickerDay] = useState<string | null>(null);
  const hoverDayRef = useRef<string | null>(null);
  const mealPickerDayRef = useRef<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillsGridRef = useRef<any>(null);
  const pillsGridTopRef = useRef<number>(0);
  const pillsScrollXRef = useRef<number>(0);
  const dragWeeksRef = useRef<string[][]>([]);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [hoverMealType, setHoverMealType] = useState<MealType | null>(null);
  const hoverMealTypeRef = useRef<MealType | null>(null);
  const containerRef = useRef<View>(null);
  const mealOptionRefs = useRef<(any | null)[]>([null, null, null, null]);
  const mealOptionRectsRef = useRef<Array<{ x: number; y: number; w: number; h: number } | null>>([null, null, null, null]);
  const backButtonRef = useRef<any>(null);
  const backButtonRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Month view animation
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const monthAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !isDraggingRef.current && Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 40) {
          // expand to month
          setViewMode('month');
          Animated.spring(monthAnim, { toValue: 1, useNativeDriver: false, bounciness: 4 }).start();
        } else if (g.dy < -30) {
          // collapse to week
          Animated.spring(monthAnim, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start(() =>
            setViewMode('week')
          );
        }
      },
    })
  ).current;
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(todayISODate());

  const [shopStartDate, setShopStartDate] = useState<string>(() => {
    const today = new Date();
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    return localISODate(monday);
  });
  const [shopEndDate, setShopEndDate] = useState<string>(() => {
    const today = new Date();
    const dow = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + (dow === 0 ? 0 : 7 - dow));
    return localISODate(sunday);
  });

  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<{ date: string; mealType: MealType } | null>(null);
  const [replacingEntryId, setReplacingEntryId] = useState<string | null>(null);

  const [servingsVisible, setServingsVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);
  const [planView, setPlanView] = useState<'plan' | 'shop'>('plan');

  const [looseIngTarget, setLooseIngTarget] = useState<{ date: string; mealType: MealType } | null>(null);

  // Measure meal option cards as soon as the picker overlay appears
  useEffect(() => {
    if (isDragging && mealPickerDay) {
      requestAnimationFrame(() => {
        MEAL_TYPES.forEach((_, i) => {
          mealOptionRefs.current[i]?.measure((_fx: number, _fy: number, w: number, h: number, px: number, py: number) => {
            mealOptionRectsRef.current[i] = { x: px, y: py, w, h };
          });
        });
        backButtonRef.current?.measure((_fx: number, _fy: number, w: number, h: number, px: number, py: number) => {
          backButtonRectRef.current = { x: px, y: py, w, h };
        });
      });
    } else {
      mealOptionRectsRef.current = [null, null, null, null];
      backButtonRectRef.current = null;
    }
  }, [isDragging, mealPickerDay]);

  const load = useCallback(async () => {
    if (!user) return;
    const [plan, allRecipes, luMap, ings] = await Promise.all([
      getOrCreateGlobalPlan(user.id, household?.id),
      getAllAccessibleRecipes(),
      getRecipeLastUsedMap(),
      getIngredients(),
    ]);
    setGlobalPlan(plan);
    setRecipes(allRecipes);
    setLastUsedMap(luMap);
    setAllIngredients(ings);
    const planEntries = await getEntriesForPlan(plan.id);
    setEntries(planEntries);
  }, []);

  useEffect(() => { load().catch(console.warn); }, []);

  function openSelector(date: string, mealType: MealType) {
    setSelectorTarget({ date, mealType });
    setSelectorVisible(true);
  }

  function openSelectorForChange(entry: MealPlanEntry) {
    setReplacingEntryId(entry.id);
    setSelectorTarget({ date: entry.date, mealType: entry.mealType });
    setSelectorVisible(true);
  }

  async function handleSelectRecipe(recipe: Recipe, servings: number) {
    if (!globalPlan?.id || !selectorTarget) return;
    setSelectorVisible(false);

    try {
      if (replacingEntryId) {
        await deleteEntry(replacingEntryId);
        setEntries((prev) => prev.filter((e) => e.id !== replacingEntryId));
        setReplacingEntryId(null);
      }

      const entry: MealPlanEntry = {
        id: newId(),
        mealPlanId: globalPlan.id,
        date: selectorTarget.date,
        mealType: selectorTarget.mealType,
        recipeId: recipe.id,
        servings,
      };
      await saveEntry(entry);
      setEntries((prev) => [...prev, entry]);
      setLastUsedMap((prev) => ({ ...prev, [recipe.id]: selectorTarget.date }));
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

  function openAddMenu(date: string, mealType: MealType) {
    setSelectorTarget({ date, mealType });
    setLooseIngTarget({ date, mealType });
    setSelectorVisible(true);
  }

  async function handleAddLooseIngredient(
    ingredientId: string | null,
    name: string,
    quantity: number,
    unit: string
  ) {
    if (!globalPlan?.id || !looseIngTarget) return;
    try {
      let resolvedId = ingredientId;
      if (!resolvedId) {
        // Create a new ingredient in the catalog
        const newIng = {
          id: newId(),
          name,
          defaultUnit: unit,
        };
        await addIngredient(newIng);
        setAllIngredients((prev) => [...prev, newIng]);
        resolvedId = newIng.id;
      }

      const entry: MealPlanEntry = {
        id: newId(),
        mealPlanId: globalPlan.id,
        date: looseIngTarget.date,
        mealType: looseIngTarget.mealType,
        recipeId: null,
        ingredientId: resolvedId,
        quantity,
        unit,
        ingredientName: name,
      };
      await saveEntry(entry);
      setEntries((prev) => [...prev, entry]);
    } catch (err: any) {
      Alert.alert('Error', `No se pudo guardar el ingrediente: ${err?.message ?? err}`);
    }
  }

  async function handleDeleteLooseEntry(entryId: string) {
    await deleteEntry(entryId);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  // ── Drag handlers ────────────────────────────────────────────────────────────

  function handleDragStart(entry: MealPlanEntry, recipe: Recipe, pageX: number, pageY: number) {
    dragWeeksRef.current = [-1, 0, 1, 2, 3].map((o) => getWeekDays(weekOffset + o));

    // Measure pills grid top in screen coords for hit-testing
    if (pillsGridRef.current) {
      pillsGridRef.current.measure((_: number, __: number, ___: number, ____: number, _px: number, py: number) => {
        pillsGridTopRef.current = py;
      });
    }
    setDragEntry(entry);
    setDragRecipe(recipe);
    isDraggingRef.current = true;
    setIsDragging(true);
    // Modal is full-screen, so use raw screen coords for floating card
    dragAnim.setValue({ x: pageX - DRAG_CARD_WIDTH / 2, y: pageY - 40 });
    // Auto-expand calendar
    if (viewMode !== 'month') {
      setViewMode('month');
      Animated.spring(monthAnim, { toValue: 1, useNativeDriver: false, bounciness: 4 }).start();
    }
  }

  function handleDragMove(pageX: number, pageY: number) {
    dragAnim.setValue({ x: pageX - DRAG_CARD_WIDTH / 2, y: pageY - 40 });

    // If meal picker is showing…
    if (mealPickerDayRef.current) {
      // Check if finger is over the back (X) button — dismiss picker and resume day selection
      const br = backButtonRectRef.current;
      if (br && pageX >= br.x && pageX <= br.x + br.w && pageY >= br.y && pageY <= br.y + br.h) {
        mealPickerDayRef.current = null;
        setMealPickerDay(null);
        hoverMealTypeRef.current = null;
        setHoverMealType(null);
        // Fall through to normal day hover detection below
      } else {
        // Detect which meal option card the finger is over
        let foundMealType: MealType | null = null;
        mealOptionRectsRef.current.forEach((r, i) => {
          if (r && pageX >= r.x && pageX <= r.x + r.w && pageY >= r.y && pageY <= r.y + r.h) {
            foundMealType = MEAL_TYPES[i].key;
          }
        });
        if (foundMealType !== hoverMealTypeRef.current) {
          hoverMealTypeRef.current = foundMealType;
          setHoverMealType(foundMealType);
        }
        return;
      }
    }

    const relY = pageY - pillsGridTopRef.current;
    const relX = pageX + pillsScrollXRef.current;
    let foundDay: string | null = null;
    if (relY >= 0 && relY < 72 * 5 && relX >= 8) {
      const row = Math.floor(relY / 72);
      const col = Math.floor((relX - 8) / (56 + 8));
      if (row >= 0 && row < 5 && col >= 0 && col < 7) {
        foundDay = dragWeeksRef.current[row]?.[col] ?? null;
      }
    }

    if (foundDay !== hoverDayRef.current) {
      if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
      hoverDayRef.current = foundDay;
      setHoverDay(foundDay);
      if (foundDay) {
        hoverTimerRef.current = setTimeout(() => {
          mealPickerDayRef.current = foundDay;
          setMealPickerDay(foundDay);
        }, 2000);
      }
    }
  }

  function handleDragEnd(_pageX: number, _pageY: number) {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    const day = hoverDayRef.current;
    const pickerDay = mealPickerDayRef.current;
    const mealType = hoverMealTypeRef.current;
    hoverDayRef.current = null;
    hoverMealTypeRef.current = null;
    setHoverDay(null);
    setHoverMealType(null);
    isDraggingRef.current = false;
    setIsDragging(false);

    if (pickerDay) {
      // Picker was showing — drop into hovered meal type (or cancel if none)
      if (mealType && dragEntry) {
        executeDrop(pickerDay, mealType);
      } else {
        mealPickerDayRef.current = null;
        setMealPickerDay(null);
        setDragEntry(null);
        setDragRecipe(null);
      }
      return;
    }

    if (day && dragEntry) {
      executeDrop(day, dragEntry.mealType);
    } else {
      setDragEntry(null);
      setDragRecipe(null);
    }
  }

  function handleDragCancel() {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    hoverDayRef.current = null;
    hoverMealTypeRef.current = null;
    mealPickerDayRef.current = null;
    setHoverDay(null);
    setHoverMealType(null);
    isDraggingRef.current = false;
    setIsDragging(false);
    setDragEntry(null);
    setDragRecipe(null);
    setMealPickerDay(null);
  }

  async function executeDrop(day: string, mealType: MealType) {
    if (!dragEntry) return;
    const updated: MealPlanEntry = { ...dragEntry, date: day, mealType };
    try {
      await saveEntry(updated);
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo mover la receta');
    }
    mealPickerDayRef.current = null;
    hoverMealTypeRef.current = null;
    setMealPickerDay(null);
    setHoverMealType(null);
    setDragEntry(null);
    setDragRecipe(null);
  }

  const weekDays = getWeekDays(weekOffset);
  const currentWeekStart = weekDays[0];
  const recipeMap: Record<string, Recipe> = {};
  for (const r of recipes) recipeMap[r.id] = r;

  function entriesFor(date: string, mealType: MealType) {
    return entries.filter((e) => e.date === date && e.mealType === mealType);
  }

  if (!globalPlan) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Cargando planificación…</Text>
      </View>
    );
  }

  const editingRecipeName = editingEntry ? (recipeMap[editingEntry.recipeId ?? '']?.name ?? '') : '';

  const KCAL_GOAL = 2000;

  const dayKcal = entries
    .filter((e) => e.date === selectedDate && e.recipeId)
    .reduce((acc, e) => {
      const r = recipeMap[e.recipeId!];
      return r ? acc + r.caloriesPerServing * (e.servings ?? 1) : acc;
    }, 0);

  return (
    <View ref={containerRef} testID="planning-container" style={styles.container}>
      {/* Week navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekOffset((w) => w - 1)} style={styles.weekNavBtn}>
          <ChevronLeft size={22} color={C.primary} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setWeekOffset(0)}
          style={styles.weekNavCenter}
          activeOpacity={weekOffset !== 0 ? 0.7 : 1}
        >
          <Text style={styles.weekNavLabel}>{getWeekLabel(weekOffset)}</Text>
          {weekOffset !== 0 && <Text style={styles.weekNavToday}>Volver a hoy</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setWeekOffset((w) => w + 1)} style={styles.weekNavBtn}>
          <ChevronRight size={22} color={C.primary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Internal view tabs */}
      <View style={styles.viewTabs}>
        <TouchableOpacity
          testID="planning-tabPlan"
          style={[styles.viewTab, planView === 'plan' && styles.viewTabActive]}
          onPress={() => setPlanView('plan')}
        >
          <Text style={[styles.viewTabText, planView === 'plan' && styles.viewTabTextActive]}>Planificación</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="planning-tabShop"
          style={[styles.viewTab, planView === 'shop' && styles.viewTabActive]}
          onPress={() => setPlanView('shop')}
        >
          <Text style={[styles.viewTabText, planView === 'shop' && styles.viewTabTextActive]}>Lista de la compra</Text>
        </TouchableOpacity>
      </View>

      {planView === 'shop' ? (
        <View style={{ flex: 1 }}>
          {/* Date range selector */}
          <View style={styles.shopDateBar}>
            <View style={styles.shopDateStepper}>
              <TouchableOpacity style={styles.shopDateArrow} onPress={() => setShopStartDate((d) => shiftDate(d, -1))}>
                <ChevronLeft size={16} color={C.primary} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.shopDateText}>{formatDateShort(shopStartDate)}</Text>
              <TouchableOpacity style={styles.shopDateArrow} onPress={() => setShopStartDate((d) => shiftDate(d, 1))}>
                <ChevronRight size={16} color={C.primary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={styles.shopDateSep}>–</Text>
            <View style={styles.shopDateStepper}>
              <TouchableOpacity
                style={styles.shopDateArrow}
                onPress={() => setShopEndDate((d) => { const next = shiftDate(d, -1); return next >= shopStartDate ? next : d; })}
              >
                <ChevronLeft size={16} color={C.primary} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.shopDateText}>{formatDateShort(shopEndDate)}</Text>
              <TouchableOpacity style={styles.shopDateArrow} onPress={() => setShopEndDate((d) => shiftDate(d, 1))}>
                <ChevronRight size={16} color={C.primary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
          <ShoppingListScreen activePlanId={globalPlan.id} startDate={shopStartDate} endDate={shopEndDate} />
        </View>
      ) : (<>
      {/* 5-row pills grid with pull-down expansion */}
      {(() => {
        const PILL_ROW_H = 72;
        // 5 rows: prev week, current week, +1, +2, +3
        const calendarWeeks = [-1, 0, 1, 2, 3].map((o) => getWeekDays(weekOffset + o));
        const containerHeight = monthAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [PILL_ROW_H, PILL_ROW_H * 5],
        });
        // In collapsed state, show row 1 (current week at y=PILL_ROW_H); translateY=-72 brings it to y=0
        const innerOffset = monthAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-PILL_ROW_H, 0],
        });

        return (
          <Animated.View
            ref={pillsGridRef}
            collapsable={false}
            style={[styles.pillsGridContainer, { height: containerHeight }]}
            {...panResponder.panHandlers}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => { pillsScrollXRef.current = e.nativeEvent.contentOffset.x; }}
            >
            <Animated.View style={{ transform: [{ translateY: innerOffset }] }}>
              {calendarWeeks.map((weekDaysRow, rowIdx) => (
                <View key={rowIdx} style={styles.pillsRow}>
                  {weekDaysRow.map((isoDate) => {
                    const active = selectedDate === isoDate;
                    const isToday = isoDate === todayISODate();
                    const isHovered = hoverDay === isoDate && !active;
                    return (
                      <TouchableOpacity
                        key={isoDate}
                        testID={rowIdx === 1 ? `planning-dayPill-${isoDate}` : undefined}
                        style={[styles.dayPill, active && styles.dayPillActive, isHovered && styles.dayPillHovered]}
                        onPress={() => {
                          setSelectedDate(isoDate);
                          setWeekOffset(weekOffset + rowIdx - 1);
                          // Collapse on tap if expanded
                          if (viewMode === 'month') {
                            Animated.spring(monthAnim, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start(() =>
                              setViewMode('week')
                            );
                          }
                        }}
                      >
                        <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>
                          {dateToDayAbbr(isoDate).toUpperCase()}
                        </Text>
                        <Text style={[styles.dayPillDate, active && styles.dayPillDateActive, isToday && !active && styles.dayPillDateToday]}>
                          {dateToDayNum(isoDate)}
                        </Text>
                        <View style={styles.dayPillLines}>
                          {MEAL_TYPES.map(({ key }) => {
                            const filled = entries.some((e) => e.date === isoDate && e.mealType === key);
                            return (
                              <View key={key} style={[styles.dayPillLine, filled && styles.dayPillLineFilled]} />
                            );
                          })}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </Animated.View>
            </ScrollView>
          </Animated.View>
        );
      })()}

      <ScrollView testID="planning-scroll" scrollEnabled={scrollEnabled} style={styles.scroll} contentContainerStyle={styles.scrollContent} automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never">

        {/* Daily kcal box */}
        <View testID="planning-kcalBox" style={styles.kcalBox}>
          <View>
            <Text style={styles.kcalBoxDayName}>{dateToDayLabel(selectedDate)}</Text>
            <Text style={styles.kcalBoxLabel}>Total del día</Text>
          </View>
          <Text style={styles.kcalBoxValue}>{dayKcal > 0 ? `${Math.round(dayKcal)} kcal` : '— kcal'}</Text>
        </View>

        {/* Meal slots for selected day */}
        {MEAL_TYPES.map(({ key: mealType, label: mealLabel, icon: MealIcon }) => {
          const slotEntries = entriesFor(selectedDate, mealType);
          const recipeEntries = slotEntries.filter((e) => e.recipeId);
          const looseEntries = slotEntries.filter((e) => e.ingredientId && !e.recipeId);
          const hasEntries = slotEntries.length > 0;

          return (
            <View key={mealType} testID={`planning-mealSlot-${mealType}`} style={styles.mealSlot}>
              <View style={styles.mealSlotHeader}>
                <MealIcon size={15} color={C.primary} strokeWidth={1.8} />
                <Text style={styles.mealSlotLabel}>{mealLabel.toUpperCase()}</Text>
                <View style={styles.mealSlotDivider} />
              </View>

              {/* Recipe entries */}
              {recipeEntries.map((entry) => {
                const recipe = entry.recipeId ? recipeMap[entry.recipeId] : null;
                if (!recipe) return null;
                return (
                  <DraggableRecipeCard
                    key={entry.id}
                    entry={entry}
                    recipe={recipe}
                    mealType={mealType}
                    MealIcon={MealIcon}
                    isDragSource={dragEntry?.id === entry.id}
                    onTap={() => setDetailRecipe(recipe)}
                    onEditServings={() => openServingsModal(entry)}
                    onChangeMeal={() => openSelectorForChange(entry)}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                    onScrollEnable={setScrollEnabled}
                  />
                );
              })}

              {/* Loose ingredient entries */}
              {looseEntries.map((entry) => {
                const ing = allIngredients.find((i) => i.id === entry.ingredientId);
                const displayName = ing?.name ?? entry.ingredientName ?? '?';
                return (
                  <View key={entry.id} style={styles.looseIngRow}>
                    <Text style={styles.looseIngText}>
                      {entry.quantity} {entry.unit} — {displayName}
                    </Text>
                    <TouchableOpacity onPress={() => handleDeleteLooseEntry(entry.id)} style={styles.looseIngDelete}>
                      <Text style={styles.looseIngDeleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Add button */}
              <TouchableOpacity
                style={[styles.addSlotBtn, hasEntries && styles.addSlotBtnCompact]}
                onPress={() => openAddMenu(selectedDate, mealType)}
              >
                <Text style={styles.addSlotBtnText}>{hasEntries ? '+ Añadir más' : '+ Añadir'}</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Weekly summary bars */}
        {entries.length > 0 && (
          <View testID="planning-weekSummary" style={styles.weekSummary}>
            <Text style={styles.weekSummaryTitle}>Resumen de la semana</Text>
            {weekDays.map((isoDate) => {
              const kcal = entries
                .filter((e) => e.date === isoDate && e.recipeId)
                .reduce((acc, e) => {
                  const r = recipeMap[e.recipeId!];
                  return r ? acc + r.caloriesPerServing * (e.servings ?? 1) : acc;
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
        {entries.length > 0 && (
          <TouchableOpacity
            testID="planning-generateBtn"
            style={styles.generateBtn}
            onPress={() => setPlanView('shop')}
          >
            <View style={styles.generateBtnContent}>
              <ShoppingCart size={18} color="#fff" strokeWidth={1.8} />
              <Text style={styles.generateBtnText}> Generar lista de la compra</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
      </>)}

      <RecipeSelector
        visible={selectorVisible}
        recipes={recipes}
        lastUsedMap={lastUsedMap}
        currentWeekStart={currentWeekStart}
        currentEntries={entries}
        ingredients={allIngredients}
        onSelect={handleSelectRecipe}
        onAddLooseIngredient={handleAddLooseIngredient}
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

      <RecipeDetailModal
        recipe={detailRecipe}
        allIngredients={allIngredients}
        visible={detailRecipe !== null}
        onClose={() => setDetailRecipe(null)}
      />

      {/* Full-screen drag overlay — covers header, content and tab bar */}
      <Modal visible={isDragging} transparent statusBarTranslucent animationType="none">
        <View pointerEvents="none" style={{ flex: 1 }}>

          {/* Dim overlay — only when meal picker is active */}
          {mealPickerDay && (
            <View style={styles.mealPickerDimOverlay} />
          )}

          {/* Meal picker */}
          {mealPickerDay && (
            <View style={styles.mealPickerFloating}>
              {/* X button — red circle, centered, at the top */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View ref={backButtonRef} collapsable={false} style={styles.mealPickerBackButton}>
                  <Text style={styles.mealPickerBackButtonText}>✕</Text>
                </View>
              </View>
              {/* Day label */}
              <Text style={styles.mealPickerFloatingDay}>{formatDateShort(mealPickerDay)}</Text>
              {/* Meal option cards */}
              {MEAL_TYPES.map(({ key, label, icon: IconComp }, i) => (
                <View
                  key={key}
                  ref={(r) => { mealOptionRefs.current[i] = r; }}
                  collapsable={false}
                  style={[
                    styles.mealOptionCard,
                    { backgroundColor: MEAL_PICKER_BG[key] },
                    hoverMealType === key && styles.mealOptionCardHovered,
                  ]}
                >
                  <IconComp size={22} color={MEAL_PICKER_TEXT[key]} strokeWidth={2} />
                  <Text style={[styles.mealOptionLabel, { color: MEAL_PICKER_TEXT[key] }]}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Floating drag card */}
          {dragRecipe && (() => {
            const mealTypeKey = dragEntry?.mealType ?? 'lunch';
            const IconComp = MEAL_TYPES.find((m) => m.key === mealTypeKey)?.icon ?? Utensils;
            return (
              <Animated.View
                style={[styles.floatingCard, { transform: [{ translateX: dragAnim.x }, { translateY: dragAnim.y }] }]}
              >
                <View style={[styles.mealSlotIconBox, { backgroundColor: MEAL_BG[mealTypeKey] }]}>
                  <IconComp size={22} color={C.textSecondary} strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealSlotName} numberOfLines={1}>{dragRecipe.name}</Text>
                  {dragRecipe.caloriesPerServing > 0 && (
                    <View style={styles.mealSlotKcalRow}>
                      <Flame size={11} color="#FF7043" strokeWidth={1.8} />
                      <Text style={styles.mealSlotKcal}> {Math.round(dragRecipe.caloriesPerServing * (dragEntry?.servings ?? 1))} kcal</Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            );
          })()}

        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPage },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: C.bgPage },
  emptyText: { color: C.textMuted, fontSize: 16, textAlign: 'center', lineHeight: 24 },

  // Week navigation
  weekNav: { flexDirection: 'row', alignItems: 'center', height: 52, backgroundColor: C.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  weekNavBtn: { width: 48, height: 52, alignItems: 'center', justifyContent: 'center' },
  weekNavCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  weekNavLabel: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  weekNavToday: { fontSize: 11, color: C.primary, marginTop: 2 },

  // View tabs (Planificación / Lista de la compra)
  viewTabs: { flexDirection: 'row', backgroundColor: C.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  viewTab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  viewTabActive: { borderBottomColor: C.primary },
  viewTabText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
  viewTabTextActive: { color: C.primary, fontWeight: '700' },

  // Shop date range bar
  shopDateBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, gap: 8 },
  shopDateStepper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgPage, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border },
  shopDateArrow: { padding: 8 },
  shopDateText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: C.textPrimary },
  shopDateSep: { fontSize: 16, color: C.textMuted, fontWeight: '300' },

  // Day pills
  dayPill: { width: 56, height: 56, borderRadius: 14, backgroundColor: C.bgPage, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  dayPillActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  dayPillText: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 0.4, lineHeight: 13 },
  dayPillTextActive: { color: C.primary },
  dayPillDate: { fontSize: 15, fontWeight: '700', color: C.textSecondary, marginTop: 2, lineHeight: 17 },
  dayPillDateActive: { color: C.primary },
  dayPillDateToday: { color: C.primary },
  dayPillLines: { flexDirection: 'row', gap: 3, marginTop: 6 },
  dayPillLine: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.border },
  dayPillLineFilled: { backgroundColor: C.primary },
  dayPillHovered: { backgroundColor: C.primary + '22', borderColor: C.primary, borderWidth: 2 },

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
  mealSlotCardDragging: { opacity: 0.35 },
  mealSlotTapArea: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  mealSlotIconBox: { width: 50, height: 50, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  mealSlotCardInfo: { flex: 1 },
  mealSlotName: { fontSize: 14, fontWeight: '600', color: C.textPrimary, fontFamily: FONT.serif },
  mealSlotKcalRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  mealSlotKcal: { fontSize: 12, color: C.textMuted },
  mealSlotBtns: { flexDirection: 'row', gap: 8 },
  mealSlotBtnVer: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: C.primaryLight },
  mealSlotBtnVerText: { fontSize: 12, color: C.primary, fontWeight: '600' },
  mealSlotBtnCambiar: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: '#FFF3E0' },
  mealSlotBtnCambiarText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  addSlotBtn: { marginHorizontal: 14, marginVertical: 12, paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: C.primary + '66', borderStyle: 'dashed' },
  addSlotBtnCompact: { paddingVertical: 8, marginVertical: 6 },
  addSlotBtnText: { color: C.primary, fontSize: 14, fontWeight: '600' },
  looseIngRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  looseIngText: { flex: 1, fontSize: 13, color: C.textSecondary, fontStyle: 'italic' },
  looseIngDelete: { padding: 6 },
  looseIngDeleteText: { fontSize: 14, color: C.textMuted },

  // Weekly summary
  weekSummary: { backgroundColor: C.bgSurface, borderRadius: RADIUS.lg, padding: 20, ...(SHADOW.sm as any), gap: 10 },
  weekSummaryTitle: { fontSize: 14, fontWeight: '700', color: C.textPrimary, fontFamily: FONT.serif, marginBottom: 4 },
  macroBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 6, borderRadius: RADIUS.sm },
  macroBarRowActive: { backgroundColor: C.primaryLight },
  macroBarLabel: { fontSize: 12, color: C.textSecondary, width: 46 },
  macroBarLabelActive: { color: C.primary, fontWeight: '700' },
  macroBarTrack: { flex: 1, height: 8, backgroundColor: C.bgPage, borderRadius: RADIUS.pill, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: RADIUS.pill },
  macroBarVal: { fontSize: 12, color: C.textMuted, width: 40, textAlign: 'right' },

  // 5-row pills grid container (expandable via pull-down)
  pillsGridContainer: { overflow: 'hidden', backgroundColor: C.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  pillsRow: { flexDirection: 'row', paddingHorizontal: 8, height: 72, alignItems: 'center', gap: 8 },

  // Generate button
  generateBtn: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center', ...(SHADOW.sm as any) },
  generateBtnContent: { flexDirection: 'row', alignItems: 'center' },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Recipe Selector Modal
  selectorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  selectorCard: { backgroundColor: C.bgSurface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, height: 700 },
  selectorTitle: { fontSize: 17, fontWeight: '700', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, fontFamily: FONT.serif, color: C.textPrimary },
  searchInput: { margin: 14, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.xl, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, backgroundColor: C.bgInput, color: C.textPrimary },
  selectorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  selectorRowMain: { flex: 1 },
  selectorName: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
  selectorMeta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  selectorLastUsed: { fontSize: 12, color: C.primary, marginLeft: 12 },
  selectorEmpty: { textAlign: 'center', color: C.textMuted, padding: 40 },
  selectorRowPending: { backgroundColor: C.primaryLight },
  selectorServingsPanel: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.bgSurface, gap: 10 },
  selectorServingsName: { fontSize: 14, fontWeight: '700', color: C.textPrimary, fontFamily: FONT.serif },
  selectorServingsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectorServingsLabel: { fontSize: 13, color: C.textSecondary, flex: 1 },
  selectorServingsBtn: { width: 34, height: 34, borderRadius: RADIUS.pill, backgroundColor: C.bgPage, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  selectorServingsBtnText: { fontSize: 20, color: C.primary, fontWeight: '300', lineHeight: 24 },
  selectorServingsVal: { fontSize: 18, fontWeight: '700', color: C.textPrimary, minWidth: 28, textAlign: 'center' },
  selectorServingsConfirm: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingHorizontal: 20, paddingVertical: 10, marginLeft: 8 },
  selectorServingsConfirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  selectorCancel: { padding: 18, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  selectorCancelText: { color: C.danger, fontWeight: '600', fontSize: 16 },

  // Tab bar inside selector
  selectorTabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  selectorTab: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  selectorTabActive: { borderBottomColor: C.primary },
  selectorTabText: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  selectorTabTextActive: { color: C.primary },

  // Ingredient tab content
  ingTabContent: { flex: 1, paddingTop: 0 },
  ingTabSuggestion: { backgroundColor: C.bgPage, borderRadius: RADIUS.xs, marginHorizontal: 14, marginTop: -8, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  ingTabSuggestionText: { color: C.primary, fontSize: 13 },
  ingTabQtyRow: { flexDirection: 'row', gap: 10, marginHorizontal: 14, marginBottom: 8 },
  ingTabLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, marginTop: 4 },
  ingTabUnitBtn: { justifyContent: 'center' },
  ingTabUnitBtnText: { fontSize: 15, color: C.textPrimary, fontWeight: '600' },
  ingTabUnitPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 14, marginBottom: 10 },
  ingTabUnitOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgPage },
  ingTabUnitOptionActive: { backgroundColor: C.primary, borderColor: C.primary },
  ingTabUnitOptionText: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  ingTabUnitOptionTextActive: { color: '#fff' },
  ingTabConfirmBtn: { marginHorizontal: 14, paddingHorizontal: 0, paddingVertical: 14, borderRadius: RADIUS.pill, alignItems: 'center', marginTop: 8 },

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

  // Floating drag card (uses transform so it never jumps on layout changes)
  floatingCard: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DRAG_CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.lg,
    padding: 14,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 999,
  },

  // Meal picker floating overlay (shown while dragging after 2s hover)
  mealPickerDimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  mealPickerFloating: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 140,
    justifyContent: 'center',
    gap: 14,
  },
  mealPickerFloatingDay: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  mealPickerBackButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealPickerBackButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  mealOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 32,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mealOptionCardHovered: {
    borderColor: '#00000033',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  mealOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
