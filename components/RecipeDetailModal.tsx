import { CalendarPlus, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { C, FONT, RADIUS } from '../constants/theme';
import { getOrCreateGlobalPlan, saveEntry } from '../storage/mealPlanStorage';
import { Ingredient, MealPlanEntry, MealType, Recipe, RecipeIngredient } from '../types/Recipe';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function localISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localISODate(d);
}

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

const MEAL_LABEL_ES: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch:     'Almuerzo',
  snack:     'Merienda',
  dinner:    'Cena',
};

const DIFFICULTY_LABEL_ES: Record<string, string> = {
  easy:   'Fácil',
  medium: 'Media',
  hard:   'Difícil',
};

const MEAL_TYPES_FOR_PLAN: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'lunch',     label: 'Almuerzo' },
  { key: 'snack',     label: 'Merienda' },
  { key: 'dinner',    label: 'Cena'     },
];

// ─── Add-to-Plan sub-modal ─────────────────────────────────────────────────────

type AddToPlanProps = {
  visible: boolean;
  recipe: Recipe;
  userId: string;
  householdId?: string | null;
  onClose: () => void;
};

function AddToPlanSubModal({ visible, recipe, userId, householdId, onClose }: AddToPlanProps) {
  const [date, setDate] = useState(() => localISODate(new Date()));
  const [mealType, setMealType] = useState<MealType>(recipe.mealType);
  const [servings, setServings] = useState(recipe.servings > 0 ? recipe.servings : 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDate(localISODate(new Date()));
      setMealType(recipe.mealType);
      setServings(recipe.servings > 0 ? recipe.servings : 1);
    }
  }, [visible]);

  async function handleAdd() {
    setSaving(true);
    try {
      const plan = await getOrCreateGlobalPlan(userId, householdId);
      const entry: MealPlanEntry = {
        id: newId(),
        mealPlanId: plan.id,
        date,
        mealType,
        recipeId: recipe.id,
        servings,
      };
      await saveEntry(entry);
      onClose();
      Alert.alert('¡Añadido!', `"${recipe.name}" añadido al planning del ${formatDate(date)}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo añadir al planning');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={atp.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={atp.card} activeOpacity={1}>
          <Text style={atp.title}>Añadir al planning</Text>

          <Text style={atp.label}>DÍA</Text>
          <View style={atp.stepper}>
            <TouchableOpacity style={atp.stepperArrow} onPress={() => setDate((d) => shiftDate(d, -1))}>
              <ChevronLeft size={20} color={C.primary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={atp.stepperText}>{formatDate(date)}</Text>
            <TouchableOpacity style={atp.stepperArrow} onPress={() => setDate((d) => shiftDate(d, 1))}>
              <ChevronRight size={20} color={C.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={[atp.label, { marginTop: 16 }]}>COMIDA</Text>
          <View style={atp.mealRow}>
            {MEAL_TYPES_FOR_PLAN.map((mt) => (
              <TouchableOpacity
                key={mt.key}
                style={[atp.mealPill, mealType === mt.key && atp.mealPillActive]}
                onPress={() => setMealType(mt.key)}
              >
                <Text style={[atp.mealPillText, mealType === mt.key && atp.mealPillTextActive]}>
                  {mt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[atp.label, { marginTop: 16 }]}>RACIONES</Text>
          <View style={atp.servRow}>
            <TouchableOpacity style={atp.servBtn} onPress={() => setServings((v) => Math.max(1, v - 1))}>
              <Text style={atp.servBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={atp.servVal}>{servings}</Text>
            <TouchableOpacity style={atp.servBtn} onPress={() => setServings((v) => v + 1)}>
              <Text style={atp.servBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={atp.confirmBtn} onPress={handleAdd} disabled={saving}>
            <Text style={atp.confirmText}>{saving ? 'Guardando…' : 'Añadir al planning'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={atp.cancelBtn} onPress={onClose}>
            <Text style={atp.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── RecipeDetailModal ─────────────────────────────────────────────────────────

type Props = {
  recipe: Recipe | null;
  allIngredients: Ingredient[];
  visible: boolean;
  onClose: () => void;
};

export default function RecipeDetailModal({ recipe, allIngredients, visible, onClose }: Props) {
  const { user, household } = useAuth();
  const [addToPlanVisible, setAddToPlanVisible] = useState(false);
  const [displayServings, setDisplayServings] = useState(1);

  useEffect(() => {
    if (recipe) setDisplayServings(recipe.servings > 0 ? recipe.servings : 1);
  }, [recipe?.id]);

  if (!recipe) return null;

  const ingName = (ri: RecipeIngredient) =>
    allIngredients.find((i) => i.id === ri.ingredientId)?.name ?? ri.ingredientId;
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const filledSteps = recipe.steps.filter((s) => s.trim());
  const scale = recipe.servings > 0 ? displayServings / recipe.servings : 1;

  function formatQty(qty: number): string {
    const scaled = qty * scale;
    if (Number.isInteger(scaled)) return String(scaled);
    const fixed = scaled.toFixed(1);
    return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.flex}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <X size={26} color={C.primary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{recipe.name}</Text>
          <TouchableOpacity onPress={() => setAddToPlanVisible(true)} style={s.planBtn}>
            <CalendarPlus size={16} color="#fff" strokeWidth={2} />
            <Text style={s.planBtnText}>Planning</Text>
          </TouchableOpacity>
        </View>

        {user && (
          <AddToPlanSubModal
            visible={addToPlanVisible}
            recipe={recipe}
            userId={user.id}
            householdId={household?.id}
            onClose={() => setAddToPlanVisible(false)}
          />
        )}

        <ScrollView style={s.flex} contentContainerStyle={s.content}>
          {/* Photo */}
          {recipe.photoUri ? (
            <Image source={{ uri: recipe.photoUri }} style={s.photo} />
          ) : null}

          {/* Tags */}
          <View style={[s.chipRow, { marginTop: recipe.photoUri ? 0 : 4 }]}>
            <View style={[s.chip, s.chipActive]}>
              <Text style={[s.chipText, s.chipTextActive]}>{MEAL_LABEL_ES[recipe.mealType]}</Text>
            </View>
            <View style={s.chip}>
              <Text style={s.chipText}>{DIFFICULTY_LABEL_ES[recipe.difficulty]}</Text>
            </View>
            {recipe.origin ? (
              <View style={s.chip}>
                <Text style={s.chipText}>{recipe.origin}</Text>
              </View>
            ) : null}
          </View>

          {/* Meta boxes */}
          <View style={[s.row3, { marginBottom: 20 }]}>
            {totalTime > 0 ? (
              <View style={s.metaBox}>
                <Text style={s.metaValue}>{totalTime} min</Text>
                <Text style={s.metaLabel}>Tiempo total</Text>
              </View>
            ) : null}

            {/* Servings with +/- adjuster */}
            <View style={s.metaBox}>
              <View style={s.servingsRow}>
                <TouchableOpacity onPress={() => setDisplayServings((v) => Math.max(1, v - 1))} style={s.servingsBtn}>
                  <Text style={s.servingsBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.metaValue}>{displayServings}</Text>
                <TouchableOpacity onPress={() => setDisplayServings((v) => v + 1)} style={s.servingsBtn}>
                  <Text style={s.servingsBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.metaLabel}>Raciones</Text>
            </View>

            {recipe.caloriesPerServing > 0 ? (
              <View style={s.metaBox}>
                <Text style={s.metaValue}>{recipe.caloriesPerServing} kcal</Text>
                <Text style={s.metaLabel}>Por ración</Text>
              </View>
            ) : null}
          </View>

          {/* Ingredients */}
          {recipe.ingredients.length > 0 ? (
            <>
              <Text style={s.sectionLabel}>Ingredientes</Text>
              {recipe.ingredients.map((ri, i) => (
                <View key={i} style={s.ingRow}>
                  <Text style={s.ingText}>{formatQty(ri.quantity)} {ri.unit} — {ingName(ri)}</Text>
                </View>
              ))}
            </>
          ) : null}

          {/* Steps */}
          {filledSteps.length > 0 ? (
            <>
              <Text style={s.sectionLabel}>Preparación</Text>
              {filledSteps.map((step, i) => (
                <View key={i} style={s.stepRow}>
                  <Text style={s.stepNum}>{i + 1}.</Text>
                  <Text style={s.stepText}>{step}</Text>
                </View>
              ))}
            </>
          ) : null}

          {/* Nutrition */}
          {(recipe.proteinG > 0 || recipe.fatG > 0 || recipe.carbsG > 0) ? (
            <>
              <Text style={s.sectionLabel}>Nutrición por ración</Text>
              <View style={s.row3}>
                <View style={s.metaBox}>
                  <Text style={s.metaValue}>{recipe.proteinG}g</Text>
                  <Text style={s.metaLabel}>Proteínas</Text>
                </View>
                <View style={s.metaBox}>
                  <Text style={s.metaValue}>{recipe.fatG}g</Text>
                  <Text style={s.metaLabel}>Grasas</Text>
                </View>
                <View style={s.metaBox}>
                  <Text style={s.metaValue}>{recipe.carbsG}g</Text>
                  <Text style={s.metaLabel}>Carbohidratos</Text>
                </View>
              </View>
            </>
          ) : null}

          {/* Notes */}
          {recipe.notes ? (
            <>
              <Text style={s.sectionLabel}>Notas</Text>
              <Text style={s.notes}>{recipe.notes}</Text>
            </>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bgPage },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.bgSurface,
  },
  closeBtn: { padding: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', fontFamily: FONT.serif, color: C.textPrimary, marginHorizontal: 8 },
  planBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 7 },
  planBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { padding: 20, backgroundColor: C.bgPage },
  photo: { width: '100%', height: 200, borderRadius: RADIUS.md, marginBottom: 16, resizeMode: 'cover' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgSurface },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, color: C.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  row3: { flexDirection: 'row', gap: 8 },
  metaBox: {
    flex: 1,
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  metaValue: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  metaLabel: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  servingsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  servingsBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.bgPage, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  servingsBtnText: { fontSize: 18, color: C.primary, fontWeight: '300', lineHeight: 22 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  ingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  ingText: { fontSize: 14, color: C.textPrimary, flex: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  stepNum: { fontSize: 15, color: C.primary, fontWeight: '700', marginTop: 13, fontFamily: FONT.serif },
  stepText: { flex: 1, fontSize: 14, color: C.textPrimary, lineHeight: 21, paddingTop: 10 },
  notes: {
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 21,
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
});

const atp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card: { backgroundColor: C.bgSurface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 24, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', color: C.textPrimary, fontFamily: FONT.serif, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md },
  stepperArrow: { padding: 14 },
  stepperText: { flex: 1, textAlign: 'center', fontSize: 15, color: C.textPrimary, fontWeight: '500' },
  mealRow: { flexDirection: 'row', gap: 8 },
  mealPill: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: C.bgPage, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  mealPillActive: { backgroundColor: C.primary, borderColor: C.primary },
  mealPillText: { fontSize: 12, fontWeight: '600', color: C.textSecondary },
  mealPillTextActive: { color: '#fff' },
  servRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  servBtn: { width: 44, height: 44, borderRadius: RADIUS.pill, backgroundColor: C.bgPage, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  servBtnText: { fontSize: 24, color: C.primary, fontWeight: '300' },
  servVal: { fontSize: 22, fontWeight: '700', color: C.textPrimary, minWidth: 36, textAlign: 'center' },
  confirmBtn: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: C.textMuted, fontSize: 15 },
});
