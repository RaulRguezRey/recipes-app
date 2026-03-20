import * as ImagePicker from 'expo-image-picker';
import { Sun, Moon, Coffee, Utensils, Star, FolderOpen, X, Camera, Check, XCircle, Plus, Clock, Heart, Filter, Sparkles, CalendarPlus, ChevronLeft, ChevronRight, Flame, Beef } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  type ScrollView as ScrollViewType,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ActionSheet from '../components/ActionSheet';
import RecipeDetailModal from '../components/RecipeDetailModal';
import { C, FONT, RADIUS, SHADOW } from '../constants/theme';
import SelectModal from '../components/SelectModal';
import { addIngredient, addOrigin, addRecipe, deleteRecipe, getAllAccessibleRecipes, getIngredients, getOrigins, setRecipePublic, updateRecipe } from '../storage/recipeStorage';
import { generateRecipeFromPrompt } from '../lib/groqRecipeGenerator';
import { Difficulty, Ingredient, MealPlanEntry, MealType, Recipe, RecipeIngredient } from '../types/Recipe';
import { getOrCreateGlobalPlan, saveEntry } from '../storage/mealPlanStorage';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseTxtRecipe(content: string, existingIngredients: Ingredient[]): { recipe: Recipe; newIngredients: Ingredient[] } {
  const lines = content.split('\n').map((l) => l.trim());
  const fields: Record<string, string> = {};
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  let section: 'fields' | 'ingredients' | 'steps' = 'fields';

  for (const line of lines) {
    if (line.startsWith('ingredientes:')) { section = 'ingredients'; continue; }
    if (line.startsWith('pasos:')) { section = 'steps'; continue; }
    if (section === 'fields' && line.includes(':')) {
      const idx = line.indexOf(':');
      fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    } else if (section === 'ingredients' && line.startsWith('-')) {
      ingredientLines.push(line.slice(1).trim());
    } else if (section === 'steps' && /^\d+\)/.test(line)) {
      stepLines.push(line.replace(/^\d+\)\s*/, '').trim());
    }
  }

  const mealTypeMap: Record<string, MealType> = {
    almuerzo: 'lunch', comida: 'lunch', desayuno: 'breakfast',
    merienda: 'snack', cena: 'dinner',
  };
  const difficultyMap: Record<string, Difficulty> = {
    facil: 'easy', fácil: 'easy', media: 'medium', medio: 'medium', dificil: 'hard', difícil: 'hard',
  };

  const prepTime = parseInt(fields['tiempo_preparacion_min']) || 0;
  const totalTime = parseInt(fields['tiempo_total_min']) || 0;

  const newIngredients: Ingredient[] = [];
  const recipeIngredients: RecipeIngredient[] = [];

  for (const line of ingredientLines) {
    const parts = line.split('|').map((p) => p.trim());
    const ingName = parts[0];
    if (!ingName) continue;
    const qty = parseFloat(parts[1]) || 1;
    const unit = parts[2] || 'ud';
    const existing = [...existingIngredients, ...newIngredients].find(
      (i) => i.name.toLowerCase() === ingName.toLowerCase()
    );
    let ingredientId: string;
    if (existing) {
      ingredientId = existing.id;
    } else {
      ingredientId = newId();
      newIngredients.push({ id: ingredientId, name: ingName, defaultUnit: unit });
    }
    recipeIngredients.push({ ingredientId, quantity: qty, unit });
  }

  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  const now = new Date().toISOString();

  const recipe: Recipe = {
    id: newId(),
    name: fields['titulo'] || '',
    mealType: mealTypeMap[fields['tipo']?.toLowerCase()] ?? 'lunch',
    origin: capitalize(fields['origen'] || ''),
    difficulty: difficultyMap[fields['dificultad']?.toLowerCase()] ?? 'easy',
    prepTime,
    cookTime: Math.max(0, totalTime - prepTime),
    servings: parseInt(fields['raciones']) || 1,
    ingredients: recipeIngredients,
    steps: stepLines,
    caloriesPerServing: parseInt(fields['calorias_por_racion']) || 0,
    proteinG: parseFloat(fields['proteinas_g']) || 0,
    fatG: parseFloat(fields['grasas_g']) || 0,
    carbsG: parseFloat(fields['carbohidratos_g']) || 0,
    costEur: parseFloat(fields['coste_aproximado_por_racion']) || 0,
    photoUri: fields['foto'] || null,
    isFavorite: fields['favorito'] === '1',
    isSeed: false,
    isPublic: false,
    ownerUserId: null,
    createdAt: now,
    updatedAt: now,
  };

  return { recipe, newIngredients };
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const UNITS = ['g', 'ud', 'ml', 'tsp', 'tbsp'];
const PREDEFINED_ORIGINS = ['Italiana', 'Mexicana', 'Española', 'Asiática', 'Francesa', 'Americana', 'Árabe', 'India', 'Japonesa', 'Griega'];

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
};

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

const MEAL_ICON: Record<MealType, LucideIcon> = {
  breakfast: Sun,
  lunch:     Utensils,
  snack:     Coffee,
  dinner:    Moon,
};

// ─── Meal type background colors ──────────────────────────────────────────────

const MEAL_BG: Record<MealType, string> = {
  breakfast: '#FFF8F0',
  lunch:     '#F0FFF4',
  snack:     '#F5F0FF',
  dinner:    '#F0F4FF',
};

function isNewRecipe(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────

type RecipeCardProps = {
  item: Recipe;
  onSelect: (recipe: Recipe) => void;
  onToggleFavorite: (recipe: Recipe) => void;
  showShareToggle?: boolean;
  onTogglePublic?: (recipe: Recipe) => void;
};

function RecipeCard({ item, onSelect, onToggleFavorite, showShareToggle, onTogglePublic }: RecipeCardProps) {
  const Icon = MEAL_ICON[item.mealType];
  const totalTime = item.prepTime + item.cookTime;

  return (
    <TouchableOpacity testID={`recipe-card-${item.id}`} style={styles.card} onPress={() => onSelect(item)} activeOpacity={0.85}>
      {/* Colored header area */}
      <View style={[styles.cardBgArea, { backgroundColor: MEAL_BG[item.mealType] }]}>
        {item.photoUri
          ? <Image source={{ uri: item.photoUri }} style={styles.cardBgImage} />
          : <Icon size={28} color={C.textSecondary} strokeWidth={1.6} />
        }
        {/* Badge */}
        {item.isSeed && (
          <View style={styles.cardBadgeOfficial}>
            <Text style={styles.cardBadgeText}>OFICIAL</Text>
          </View>
        )}
        {!item.isSeed && item.isFavorite && (
          <View style={styles.cardBadgeFav}>
            <Text style={styles.cardBadgeText}>FAV</Text>
          </View>
        )}
        {!item.isSeed && !item.isFavorite && isNewRecipe(item.createdAt) && (
          <View style={styles.cardBadgeNew}>
            <Text style={styles.cardBadgeText}>NUEVO</Text>
          </View>
        )}
        {/* Favorite button — only for non-seeds */}
        {!item.isSeed && (
          <TouchableOpacity testID={`recipe-heartBtn-${item.id}`} style={styles.cardHeartBtn} onPress={() => onToggleFavorite(item)}>
            <Heart
              size={16}
              color={item.isFavorite ? C.accent : C.textMuted}
              fill={item.isFavorite ? C.accent : 'none'}
              strokeWidth={1.8}
            />
          </TouchableOpacity>
        )}
      </View>
      {/* Info area */}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.cardSubRow}>
          {totalTime > 0 && (
            <>
              <Clock size={11} color={C.textMuted} strokeWidth={1.8} />
              <Text style={styles.cardSub}> {totalTime}m</Text>
            </>
          )}
          {item.caloriesPerServing > 0 && (
            <>
              <Flame size={11} color="#FF7043" strokeWidth={1.8} style={totalTime > 0 ? { marginLeft: 6 } : undefined} />
              <Text style={styles.cardSub}> {item.caloriesPerServing}</Text>
            </>
          )}
          {item.proteinG > 0 && (
            <>
              <Beef size={11} color={C.info} strokeWidth={1.8} style={{ marginLeft: 6 }} />
              <Text style={[styles.cardSub, { color: C.info }]}> {item.proteinG}g</Text>
            </>
          )}
        </View>
        {showShareToggle && (
          <View style={styles.cardShareRow}>
            <Text style={styles.cardShareLabel}>Compartir</Text>
            <Switch
              value={item.isPublic}
              onValueChange={() => onTogglePublic?.(item)}
              trackColor={{ false: C.border, true: C.primaryLight }}
              thumbColor={item.isPublic ? C.primary : C.textMuted}
              style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Recipe List ──────────────────────────────────────────────────────────────

type ListViewProps = {
  recipes: Recipe[];
  onAdd: () => void;
  onSelect: (recipe: Recipe) => void;
  onToggleFavorite: (recipe: Recipe) => void;
  onTogglePublic: (recipe: Recipe) => void;
  onImport: () => void;
  activeTab: 'community' | 'mine';
  onTabChange: (tab: 'community' | 'mine') => void;
};

const CATEGORY_PILLS: { key: MealType | null; label: string }[] = [
  { key: null,        label: 'Todos'    },
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'lunch',     label: 'Almuerzo' },
  { key: 'dinner',    label: 'Cena'     },
  { key: 'snack',     label: 'Merienda' },
];

function ListView({ recipes, onAdd, onSelect, onToggleFavorite, onTogglePublic, onImport, activeTab, onTabChange }: ListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMeal, setActiveMeal] = useState<MealType | null>(null);

  const tabRecipes = activeTab === 'community'
    ? recipes.filter((r) => r.isSeed || r.isPublic)
    : recipes.filter((r) => !r.isSeed);

  const filtered = tabRecipes.filter((r) => {
    if (searchQuery.trim() && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (activeMeal && r.mealType !== activeMeal) return false;
    return true;
  });

  return (
    <View testID="recipes-listView" style={styles.flex}>
      {/* Tab bar */}
      <View testID="recipes-tabBar" style={styles.tabBar}>
        {(['community', 'mine'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            testID={`recipes-tab-${tab}`}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => onTabChange(tab)}
          >
            <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
              {tab === 'community' ? 'Comunidad' : 'Mis recetas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <TextInput
            testID="recipes-searchInput"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar receta..."
            placeholderTextColor={C.textMuted}
            clearButtonMode="while-editing"
          />
          <TouchableOpacity style={styles.filterBtn}>
            <Filter size={14} color={C.primary} strokeWidth={1.8} />
            <Text style={styles.filterBtnText}>Filtrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category filter pills */}
      <ScrollView
        testID="recipes-categoryScroll"
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryScrollContent}
      >
        {CATEGORY_PILLS.map((p) => {
          const active = activeMeal === p.key;
          return (
            <TouchableOpacity
              key={String(p.key)}
              testID={`recipes-categoryPill-${p.key ?? 'all'}`}
              style={[styles.categoryPill, active && styles.categoryPillActive]}
              onPress={() => setActiveMeal(p.key)}
            >
              <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {Platform.OS === 'web' && (
        <TouchableOpacity style={styles.importButton} onPress={onImport}>
          <View style={styles.importButtonContent}>
            <FolderOpen size={16} color={C.primary} strokeWidth={1.8} />
            <Text style={styles.importButtonText}> Import from .txt</Text>
          </View>
        </TouchableOpacity>
      )}

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {searchQuery.trim() ? 'No hay recetas con ese nombre.' : 'No recipes yet. Add your first one!'}
          </Text>
        </View>
      ) : (
        <FlatList
          testID="recipes-list"
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <RecipeCard
              item={item}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
              showShareToggle={activeTab === 'mine'}
              onTogglePublic={onTogglePublic}
            />
          )}
        />
      )}

      <TouchableOpacity testID="recipes-addBtn" style={styles.fab} onPress={onAdd}>
        <Plus size={28} color="#fff" strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Recipe Form ──────────────────────────────────────────────────────────────

type FormViewProps = {
  recipe: Recipe | null;
  allIngredients: Ingredient[];
  onSave: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
};

function FormView({ recipe, allIngredients, onSave, onDelete, onCancel }: FormViewProps) {
  const isEdit = recipe !== null;

  const [name, setName] = useState(recipe?.name ?? '');
  const [mealType, setMealType] = useState<MealType>(recipe?.mealType ?? 'lunch');
  const [difficulty, setDifficulty] = useState<Difficulty>(recipe?.difficulty ?? 'easy');
  const [origin, setOrigin] = useState(recipe?.origin ?? '');
  const [prepTime, setPrepTime] = useState(recipe?.prepTime.toString() ?? '');
  const [cookTime, setCookTime] = useState(recipe?.cookTime.toString() ?? '');
  const [servings, setServings] = useState(recipe?.servings.toString() ?? '');
  const [calories, setCalories] = useState(recipe?.caloriesPerServing.toString() ?? '');
  const [protein, setProtein] = useState(recipe?.proteinG.toString() ?? '');
  const [fat, setFat] = useState(recipe?.fatG.toString() ?? '');
  const [carbs, setCarbsG] = useState(recipe?.carbsG.toString() ?? '');
  const [cost, setCost] = useState(recipe?.costEur.toString() ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(recipe?.photoUri ?? null);
  const [isFavorite, setIsFavorite] = useState(recipe?.isFavorite ?? false);
  const [sourceUrl, setSourceUrl] = useState(recipe?.sourceUrl ?? '');
  const [notes, setNotes] = useState(recipe?.notes ?? '');

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    recipe?.ingredients ?? []
  );
  const [steps, setSteps] = useState<string[]>(recipe?.steps ?? ['']);

  const [nameError, setNameError] = useState(false);
  const scrollRef = useRef<ScrollViewType>(null);

  const [newIngName, setNewIngName] = useState('');
  const [newIngId, setNewIngId] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('g');

  // Photo action sheet
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  // AI generation
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  async function handleAIGenerate() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const generated = await generateRecipeFromPrompt(aiPrompt.trim(), localIngredients);
      // Map ingredients: match existing or create new
      const newIngredients: RecipeIngredient[] = [];
      const updatedLocal = [...localIngredients];
      for (const ing of generated.ingredients) {
        const genName = ing.name.trim().toLowerCase();
        const existing = updatedLocal.find((i) => {
          const exName = i.name.toLowerCase();
          return exName === genName || exName.startsWith(genName) || genName.startsWith(exName);
        });
        if (existing) {
          newIngredients.push({ ingredientId: existing.id, quantity: ing.quantity, unit: existing.defaultUnit });
        } else {
          const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
          const newIngId = newId();
          const newIng = { id: newIngId, name: capitalize(ing.name.trim()), defaultUnit: ing.unit };
          addIngredient(newIng);
          updatedLocal.push(newIng);
          newIngredients.push({ ingredientId: newIngId, quantity: ing.quantity, unit: ing.unit });
        }
      }
      setLocalIngredients(updatedLocal);
      // Fill form fields
      setName(generated.name);
      setMealType(generated.mealType);
      setDifficulty(generated.difficulty);
      setOrigin(generated.origin);
      setPrepTime(generated.prepTime.toString());
      setCookTime(generated.cookTime.toString());
      setServings(generated.servings.toString());
      setCalories(generated.caloriesPerServing.toString());
      setProtein(generated.proteinG.toString());
      setFat(generated.fatG.toString());
      setCarbsG(generated.carbsG.toString());
      setCost(generated.costEur.toString());
      setIngredients(newIngredients);
      setSteps(generated.steps.length > 0 ? generated.steps : ['']);
      if (generated.notes) setNotes(generated.notes);
      setShowAIModal(false);
      setAiPrompt('');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo generar la receta.');
    } finally {
      setAiLoading(false);
    }
  }

  // Origin dropdown
  const [allOrigins, setAllOrigins] = useState<string[]>([]);
  const [showOriginModal, setShowOriginModal] = useState(false);
  const [showCustomOriginInput, setShowCustomOriginInput] = useState(false);
  const [customOriginText, setCustomOriginText] = useState('');

  // Ingredient autocomplete
  const [localIngredients, setLocalIngredients] = useState<Ingredient[]>(allIngredients);

  const suggestedIng = newIngName.trim().length > 0
    ? localIngredients.find((i) =>
        i.name.toLowerCase().startsWith(newIngName.trim().toLowerCase()) &&
        i.name.toLowerCase() !== newIngName.trim().toLowerCase()
      )
    : undefined;

  useEffect(() => { getOrigins().then(setAllOrigins); }, []);

  const mergedOrigins = [
    ...PREDEFINED_ORIGINS,
    ...allOrigins.filter((o) => !PREDEFINED_ORIGINS.map((p) => p.toLowerCase()).includes(o.toLowerCase())),
  ];

  async function handleOriginSelect(value: string) {
    if (value === '__custom__') {
      setShowOriginModal(false);
      setShowCustomOriginInput(true);
    } else {
      setOrigin(value);
      setShowOriginModal(false);
    }
  }

  async function handleCustomOriginConfirm() {
    const trimmed = customOriginText.trim();
    if (!trimmed) return;
    await addOrigin(trimmed);
    const updated = await getOrigins();
    setAllOrigins(updated);
    setOrigin(trimmed);
    setCustomOriginText('');
    setShowCustomOriginInput(false);
  }

  async function pickImage(source: 'gallery' | 'camera') {
    let result;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Camera permission is required.'); return; }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Gallery permission is required.'); return; }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    }
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  function addIngredientRow() {
    const trimmed = newIngName.trim();
    if (!trimmed) return;
    let ingredientId = newIngId;
    if (!ingredientId) {
      const exact = localIngredients.find(
        (i) => i.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exact) {
        ingredientId = exact.id;
      } else {
        ingredientId = newId();
        const ing: Ingredient = { id: ingredientId, name: trimmed, defaultUnit: newIngUnit };
        addIngredient(ing);
        setLocalIngredients((prev) => [...prev, ing]);
      }
    }
    setIngredients([...ingredients, {
      ingredientId,
      quantity: parseFloat(newIngQty) || 1,
      unit: newIngUnit,
    }]);
    setNewIngId(''); setNewIngName(''); setNewIngQty(''); setNewIngUnit('g');
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateStep(index: number, value: string) {
    const updated = [...steps];
    updated[index] = value;
    setSteps(updated);
  }

  function addStep() { setSteps([...steps, '']); }
  function removeStep(index: number) { setSteps(steps.filter((_, i) => i !== index)); }

  function handleSave() {
    if (!name.trim()) { setNameError(true); scrollRef.current?.scrollTo({ y: 0, animated: true }); return; }
    setNameError(false);
    const now = new Date().toISOString();
    const saved: Recipe = {
      id: recipe?.id ?? newId(),
      name: name.trim(),
      mealType,
      difficulty,
      origin: origin.trim(),
      prepTime: parseInt(prepTime) || 0,
      cookTime: parseInt(cookTime) || 0,
      servings: parseInt(servings) || 1,
      ingredients,
      steps: steps.filter((s) => s.trim()),
      caloriesPerServing: parseInt(calories) || 0,
      proteinG: parseInt(protein) || 0,
      fatG: parseInt(fat) || 0,
      carbsG: parseInt(carbs) || 0,
      costEur: parseFloat(cost) || 0,
      photoUri,
      isFavorite,
      sourceUrl: sourceUrl.trim() || null,
      notes: notes.trim() || null,
      isSeed: recipe?.isSeed ?? false,
      isPublic: recipe?.isPublic ?? false,
      ownerUserId: recipe?.ownerUserId ?? null,
      createdAt: recipe?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(saved);
  }

  function handleDelete() {
    Alert.alert('Delete recipe', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(recipe!.id) },
    ]);
  }

  const ingName = (ri: RecipeIngredient) =>
    localIngredients.find((i) => i.id === ri.ingredientId)?.name ?? 'Unknown';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* AI Modal */}
      <Modal visible={showAIModal} transparent animationType="slide" onRequestClose={() => setShowAIModal(false)}>
        <KeyboardAvoidingView style={styles.aiOverlay} behavior="padding">
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAIModal(false)} />
          <View style={styles.aiSheet}>
            <View style={styles.aiSheetHeader}>
              <Sparkles size={18} color={C.primary} strokeWidth={1.8} />
              <Text style={styles.aiSheetTitle}>Generar receta con IA</Text>
              <TouchableOpacity onPress={() => setShowAIModal(false)}>
                <X size={22} color={C.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={styles.aiSheetHint}>Describe la receta que quieres. Cuanto más detallado, mejor resultado.</Text>
            <TextInput
              style={styles.aiInput}
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder="Ej: macarrones con chorizo usando tomate triturado, para 4 personas y que sea fácil de hacer"
              placeholderTextColor={C.textMuted}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={[styles.aiGenerateBtn, (!aiPrompt.trim() || aiLoading) && { opacity: 0.5 }]}
              onPress={handleAIGenerate}
              disabled={!aiPrompt.trim() || aiLoading}
            >
              <Text style={styles.aiGenerateBtnText}>{aiLoading ? 'Generando…' : '✨ Generar receta'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Header */}
      <View testID="recipeForm-header" style={styles.formHeader}>
        <TouchableOpacity onPress={onCancel} style={styles.formCancel}>
          <X size={26} color={C.primary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.formTitle}>{isEdit ? 'Editar receta' : 'Nueva receta'}</Text>
        <View style={styles.formHeaderRight}>
          {!isEdit && (
            <TouchableOpacity onPress={() => setShowAIModal(true)} style={styles.aiHeaderBtn}>
              <Text style={styles.aiHeaderBtnText}>AI</Text>
              <Sparkles size={16} color="#FF7043" strokeWidth={1.8} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setIsFavorite(!isFavorite)}>
            <Star
              size={22}
              color={isFavorite ? C.accent : C.textMuted}
              fill={isFavorite ? C.accent : 'none'}
              strokeWidth={1.8}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.formContent}>

        {/* Photo */}
        <Text style={styles.sectionLabel}>Photo</Text>
        <TouchableOpacity style={styles.photoBtn} onPress={() => setShowPhotoSheet(true)}>
          <View style={styles.photoBtnContent}>
            <Camera size={16} color={C.textSecondary} strokeWidth={1.8} />
            <Text style={styles.photoBtnText}> Add photo</Text>
          </View>
        </TouchableOpacity>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.photoPreview} />}
        <ActionSheet
          visible={showPhotoSheet}
          onClose={() => setShowPhotoSheet(false)}
          actions={[
            { label: 'Choose from gallery', onPress: () => { setShowPhotoSheet(false); pickImage('gallery'); } },
            { label: 'Take a photo', onPress: () => { setShowPhotoSheet(false); pickImage('camera'); } },
          ]}
        />

        {/* Basic info */}
        <Text style={styles.sectionLabel}>Name *</Text>
        <TextInput
          testID="recipeForm-nameInput"
          style={[styles.input, nameError && styles.inputError]}
          value={name}
          onChangeText={(v) => { setName(v); if (v.trim()) setNameError(false); }}
          placeholder="Recipe name"
        />
        {nameError && <Text style={styles.errorText}>Name is required</Text>}

        <Text style={styles.sectionLabel}>Origin</Text>
        <TouchableOpacity style={[styles.input, styles.selectField]} onPress={() => setShowOriginModal(true)}>
          <Text style={{ color: origin ? C.textPrimary : C.textMuted, fontSize: 15 }}>{origin || 'Select origin...'}</Text>
        </TouchableOpacity>
        {showCustomOriginInput && (
          <View style={styles.ingAddRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={customOriginText}
              onChangeText={setCustomOriginText}
              placeholder="Custom origin name"
              autoFocus
            />
            <TouchableOpacity style={styles.ingAddBtn} onPress={handleCustomOriginConfirm}>
              <Check size={18} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}
        <SelectModal
          visible={showOriginModal}
          title="Select origin"
          options={mergedOrigins.map((o) => ({ label: o, value: o }))}
          selectedValue={origin}
          onSelect={handleOriginSelect}
          onClose={() => setShowOriginModal(false)}
          addNewLabel="+ Otro (personalizado)"
          onAddNew={() => handleOriginSelect('__custom__')}
        />

        <Text style={styles.sectionLabel}>Meal type</Text>
        <View style={styles.chipRow}>
          {MEAL_TYPES.map((t) => (
            <Pressable key={t} style={[styles.chip, mealType === t && styles.chipActive]} onPress={() => setMealType(t)}>
              <Text style={[styles.chipText, mealType === t && styles.chipTextActive]}>{MEAL_LABEL[t]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Difficulty</Text>
        <View style={styles.chipRow}>
          {DIFFICULTIES.map((d) => (
            <Pressable key={d} style={[styles.chip, difficulty === d && styles.chipActive]} onPress={() => setDifficulty(d)}>
              <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>{DIFFICULTY_LABEL[d]}</Text>
            </Pressable>
          ))}
        </View>

        {/* Times & servings */}
        <Text style={styles.sectionLabel}>Times & Servings</Text>
        <View style={styles.row3}>
          <View style={styles.flex}>
            <Text style={styles.inputLabel}>Prep (min)</Text>
            <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} keyboardType="numeric" placeholder="0" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.inputLabel}>Cook (min)</Text>
            <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime} keyboardType="numeric" placeholder="0" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.inputLabel}>Servings</Text>
            <TextInput style={styles.input} value={servings} onChangeText={setServings} keyboardType="numeric" placeholder="1" />
          </View>
        </View>

        {/* Nutrition */}
        <Text style={styles.sectionLabel}>Nutrition (per serving)</Text>
        <View style={styles.row2}>
          <View style={styles.flex}>
            <Text style={styles.inputLabel}>Calories (kcal)</Text>
            <TextInput style={styles.input} value={calories} onChangeText={setCalories} keyboardType="numeric" placeholder="0" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.inputLabel}>Cost (€)</Text>
            <TextInput style={styles.input} value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
        </View>
        <View style={styles.row3}>
          <View style={styles.flex}>
            <Text style={styles.inputLabel}>Protein (g)</Text>
            <TextInput style={styles.input} value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="0" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.inputLabel}>Fat (g)</Text>
            <TextInput style={styles.input} value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="0" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.inputLabel}>Carbs (g)</Text>
            <TextInput style={styles.input} value={carbs} onChangeText={setCarbsG} keyboardType="numeric" placeholder="0" />
          </View>
        </View>

        {/* Ingredients */}
        <Text style={styles.sectionLabel}>Ingredients</Text>
        {ingredients.map((ri, i) => (
          <View key={i} style={styles.ingRow}>
            <Text style={styles.ingText}>{ri.quantity} {ri.unit} — {ingName(ri)}</Text>
            <TouchableOpacity onPress={() => removeIngredient(i)} style={styles.removeBtn}>
              <XCircle size={20} color={C.danger} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.ingAddRow}>
          <View style={{ flex: 3 }}>
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              value={newIngName}
              onChangeText={(v) => { setNewIngName(v); setNewIngId(''); }}
              placeholder="Ingredient..."
            />
            {suggestedIng && (
              <TouchableOpacity
                style={styles.suggestion}
                onPress={() => { setNewIngName(suggestedIng.name); setNewIngId(suggestedIng.id); }}
              >
                <Text style={styles.suggestionText}>{suggestedIng.name}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={[styles.input, styles.ingInputQty]}
            value={newIngQty}
            onChangeText={setNewIngQty}
            placeholder="Qty"
            keyboardType="decimal-pad"
            onFocus={() => {
              if (suggestedIng) { setNewIngName(suggestedIng.name); setNewIngId(suggestedIng.id); }
            }}
          />
          <TouchableOpacity style={styles.ingAddBtn} onPress={addIngredientRow}>
            <Text style={styles.ingAddBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chipRow}>
          {UNITS.map((u) => (
            <Pressable key={u} style={[styles.chip, newIngUnit === u && styles.chipActive]} onPress={() => setNewIngUnit(u)}>
              <Text style={[styles.chipText, newIngUnit === u && styles.chipTextActive]}>{u}</Text>
            </Pressable>
          ))}
        </View>

        {/* Steps */}
        <Text style={styles.sectionLabel}>Steps</Text>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNum}>{i + 1}.</Text>
            <TextInput
              style={[styles.input, styles.stepInput]}
              value={step}
              onChangeText={(v) => updateStep(i, v)}
              placeholder={`Step ${i + 1}`}
              multiline
            />
            <TouchableOpacity onPress={() => removeStep(i)} style={styles.removeBtn}>
              <XCircle size={20} color={C.danger} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addStepBtn} onPress={addStep}>
          <Text style={styles.addStepBtnText}>+ Add step</Text>
        </TouchableOpacity>

        {/* Source URL & Notes */}
        <Text style={styles.sectionLabel}>Additional info</Text>
        <Text style={styles.inputLabel}>Source URL</Text>
        <TextInput
          style={styles.input}
          value={sourceUrl}
          onChangeText={setSourceUrl}
          placeholder="https://…"
          keyboardType="url"
          autoCapitalize="none"
        />
        <Text style={styles.inputLabel}>Notes</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Personal notes about this recipe…"
          multiline
        />

        {/* Save */}
        <TouchableOpacity testID="recipeForm-saveBtn" style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{isEdit ? 'Save changes' : 'Save recipe'}</Text>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity testID="recipeForm-deleteBtn" style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete recipe</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Recipe Detail (read-only) ────────────────────────────────────────────────

const MEAL_LABEL_ES: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch:     'Almuerzo',
  snack:     'Merienda',
  dinner:    'Cena',
};

const DIFFICULTY_LABEL_ES: Record<Difficulty, string> = {
  easy:   'Fácil',
  medium: 'Media',
  hard:   'Difícil',
};

// ─── Add-to-Plan helpers & modal ─────────────────────────────────────────────

const ATP_DAY_ABBRS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ATP_DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ATP_MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function atpLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function atpShiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return atpLocalISODate(d);
}
function atpFormatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${ATP_DAY_LABELS[d.getDay()]} ${d.getDate()} de ${ATP_MONTH_NAMES[d.getMonth()]}`;
}

const ATP_MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'lunch',     label: 'Almuerzo' },
  { key: 'snack',     label: 'Merienda' },
  { key: 'dinner',    label: 'Cena'     },
];

type AddToPlanModalProps = {
  visible: boolean;
  recipe: Recipe;
  userId: string;
  householdId?: string | null;
  onClose: () => void;
};

function AddToPlanModal({ visible, recipe, userId, householdId, onClose }: AddToPlanModalProps) {
  const [date, setDate] = useState(() => atpLocalISODate(new Date()));
  const [mealType, setMealType] = useState<MealType>(recipe.mealType);
  const [servings, setServings] = useState(recipe.servings > 0 ? recipe.servings : 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDate(atpLocalISODate(new Date()));
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
      Alert.alert('¡Añadido!', `"${recipe.name}" añadido al planning del ${atpFormatDate(date)}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo añadir al planning');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={atpStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={atpStyles.card} activeOpacity={1}>
          <Text style={atpStyles.title}>Añadir al planning</Text>

          <Text style={atpStyles.label}>DÍA</Text>
          <View style={atpStyles.stepper}>
            <TouchableOpacity style={atpStyles.stepperArrow} onPress={() => setDate((d) => atpShiftDate(d, -1))}>
              <ChevronLeft size={20} color={C.primary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={atpStyles.stepperText}>{atpFormatDate(date)}</Text>
            <TouchableOpacity style={atpStyles.stepperArrow} onPress={() => setDate((d) => atpShiftDate(d, 1))}>
              <ChevronRight size={20} color={C.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={[atpStyles.label, { marginTop: 16 }]}>COMIDA</Text>
          <View style={atpStyles.mealRow}>
            {ATP_MEAL_TYPES.map((mt) => (
              <TouchableOpacity
                key={mt.key}
                style={[atpStyles.mealPill, mealType === mt.key && atpStyles.mealPillActive]}
                onPress={() => setMealType(mt.key)}
              >
                <Text style={[atpStyles.mealPillText, mealType === mt.key && atpStyles.mealPillTextActive]}>
                  {mt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[atpStyles.label, { marginTop: 16 }]}>RACIONES</Text>
          <View style={atpStyles.servRow}>
            <TouchableOpacity style={atpStyles.servBtn} onPress={() => setServings((v) => Math.max(1, v - 1))}>
              <Text style={atpStyles.servBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={atpStyles.servVal}>{servings}</Text>
            <TouchableOpacity style={atpStyles.servBtn} onPress={() => setServings((v) => v + 1)}>
              <Text style={atpStyles.servBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={atpStyles.confirmBtn} onPress={handleAdd} disabled={saving}>
            <Text style={atpStyles.confirmText}>{saving ? 'Guardando…' : 'Añadir al planning'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={atpStyles.cancelBtn} onPress={onClose}>
            <Text style={atpStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const atpStyles = StyleSheet.create({
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

// ─── Detail View ──────────────────────────────────────────────────────────────

type DetailViewProps = {
  recipe: Recipe;
  allIngredients: Ingredient[];
  onClose: () => void;
};

function DetailView({ recipe, allIngredients, onClose }: DetailViewProps) {
  const { user, household } = useAuth();
  const [addToPlanVisible, setAddToPlanVisible] = useState(false);

  const ingName = (ri: RecipeIngredient) =>
    allIngredients.find((i) => i.id === ri.ingredientId)?.name ?? ri.ingredientId;
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const filledSteps = recipe.steps.filter((s) => s.trim());

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={styles.formHeader}>
        <TouchableOpacity onPress={onClose} style={styles.formCancel}>
          <X size={26} color={C.primary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.formTitle, { flex: 1, marginHorizontal: 8 }]} numberOfLines={1}>{recipe.name}</Text>
        <TouchableOpacity onPress={() => setAddToPlanVisible(true)} style={styles.detailAddPlanBtn}>
          <CalendarPlus size={16} color="#fff" strokeWidth={2} />
          <Text style={styles.detailAddPlanBtnText}>Planning</Text>
        </TouchableOpacity>
      </View>

      {user && (
        <AddToPlanModal
          visible={addToPlanVisible}
          recipe={recipe}
          userId={user.id}
          householdId={household?.id}
          onClose={() => setAddToPlanVisible(false)}
        />
      )}

      <ScrollView style={styles.flex} contentContainerStyle={styles.formContent}>
        {/* Photo */}
        {recipe.photoUri ? (
          <Image source={{ uri: recipe.photoUri }} style={styles.photoPreview} />
        ) : null}

        {/* Tags */}
        <View style={[styles.chipRow, { marginTop: recipe.photoUri ? 0 : 4 }]}>
          <View style={[styles.chip, styles.chipActive]}>
            <Text style={[styles.chipText, styles.chipTextActive]}>{MEAL_LABEL_ES[recipe.mealType]}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{DIFFICULTY_LABEL_ES[recipe.difficulty]}</Text>
          </View>
          {recipe.origin ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{recipe.origin}</Text>
            </View>
          ) : null}
        </View>

        {/* Meta boxes */}
        <View style={[styles.row3, { marginBottom: 20 }]}>
          {totalTime > 0 ? (
            <View style={detailStyles.metaBox}>
              <Text style={detailStyles.metaValue}>{totalTime} min</Text>
              <Text style={detailStyles.metaLabel}>Tiempo total</Text>
            </View>
          ) : null}
          <View style={detailStyles.metaBox}>
            <Text style={detailStyles.metaValue}>{recipe.servings}</Text>
            <Text style={detailStyles.metaLabel}>Raciones</Text>
          </View>
          {recipe.caloriesPerServing > 0 ? (
            <View style={detailStyles.metaBox}>
              <Text style={detailStyles.metaValue}>{recipe.caloriesPerServing} kcal</Text>
              <Text style={detailStyles.metaLabel}>Por ración</Text>
            </View>
          ) : null}
        </View>

        {/* Ingredients */}
        {recipe.ingredients.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Ingredientes</Text>
            {recipe.ingredients.map((ri, i) => (
              <View key={i} style={styles.ingRow}>
                <Text style={styles.ingText}>{ri.quantity} {ri.unit} — {ingName(ri)}</Text>
              </View>
            ))}
          </>
        ) : null}

        {/* Steps */}
        {filledSteps.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Preparación</Text>
            {filledSteps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Text style={styles.stepNum}>{i + 1}.</Text>
                <Text style={detailStyles.stepText}>{step}</Text>
              </View>
            ))}
          </>
        ) : null}

        {/* Nutrition */}
        {(recipe.proteinG > 0 || recipe.fatG > 0 || recipe.carbsG > 0) ? (
          <>
            <Text style={styles.sectionLabel}>Nutrición por ración</Text>
            <View style={styles.row3}>
              <View style={detailStyles.metaBox}>
                <Text style={detailStyles.metaValue}>{recipe.proteinG}g</Text>
                <Text style={detailStyles.metaLabel}>Proteínas</Text>
              </View>
              <View style={detailStyles.metaBox}>
                <Text style={detailStyles.metaValue}>{recipe.fatG}g</Text>
                <Text style={detailStyles.metaLabel}>Grasas</Text>
              </View>
              <View style={detailStyles.metaBox}>
                <Text style={detailStyles.metaValue}>{recipe.carbsG}g</Text>
                <Text style={detailStyles.metaLabel}>Carbohidratos</Text>
              </View>
            </View>
          </>
        ) : null}

        {/* Notes */}
        {recipe.notes ? (
          <>
            <Text style={styles.sectionLabel}>Notas</Text>
            <Text style={detailStyles.notes}>{recipe.notes}</Text>
          </>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const detailStyles = StyleSheet.create({
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecipesScreen() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [activeTab, setActiveTab] = useState<'community' | 'mine'>('community');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    setRecipes(await getAllAccessibleRecipes());
    setAllIngredients(await getIngredients());
  }, []);

  useEffect(() => { loadData().catch(console.warn); }, [loadData]);

  async function handleSave(recipe: Recipe) {
    const existsInStorage = recipes.some((r) => r.id === editingRecipe?.id);
    if (editingRecipe && existsInStorage) {
      await updateRecipe(recipe);
    } else {
      await addRecipe(recipe, user!.id);
    }
    await loadData();
    setView('list');
    setEditingRecipe(null);
  }

  async function handleDelete(id: string) {
    await deleteRecipe(id);
    await loadData();
    setView('list');
    setEditingRecipe(null);
  }

  async function handleToggleFavorite(recipe: Recipe) {
    await updateRecipe({ ...recipe, isFavorite: !recipe.isFavorite });
    await loadData();
  }

  async function handleTogglePublic(recipe: Recipe) {
    const newVal = !recipe.isPublic;
    await setRecipePublic(recipe.id, newVal);
    setRecipes((prev) => prev.map((r) => r.id === recipe.id ? { ...r, isPublic: newVal } : r));
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const currentIngredients = await getIngredients();
    const { recipe, newIngredients } = parseTxtRecipe(content, currentIngredients);
    for (const ing of newIngredients) {
      await addIngredient(ing);
    }
    await loadData();
    setEditingRecipe(recipe);
    setView('form');
    e.target.value = '';
  }

  function openAdd() {
    setEditingRecipe(null);
    setView('form');
  }

  function openEdit(recipe: Recipe) {
    setEditingRecipe(recipe);
    const isReadOnly = recipe.isSeed || (recipe.isPublic && recipe.ownerUserId !== user?.id);
    setView(isReadOnly ? 'detail' : 'form');
  }

  if (view === 'form') {
    return (
      <FormView
        recipe={editingRecipe}
        allIngredients={allIngredients}
        onSave={handleSave}
        onDelete={handleDelete}
        onCancel={() => { setView('list'); setEditingRecipe(null); }}
      />
    );
  }

  return (
    <>
      {/* Hidden file input for web .txt import */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          style={{ display: 'none' } as any}
          onChange={handleFileImport as any}
        />
      )}
      <ListView
        recipes={recipes}
        onAdd={openAdd}
        onSelect={openEdit}
        onToggleFavorite={handleToggleFavorite}
        onTogglePublic={handleTogglePublic}
        onImport={() => fileInputRef.current?.click()}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <RecipeDetailModal
        recipe={view === 'detail' ? editingRecipe : null}
        allIngredients={allIngredients}
        visible={view === 'detail' && editingRecipe !== null}
        onClose={() => { setView('list'); setEditingRecipe(null); }}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bgPage },

  // List
  searchContainer: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.xl, paddingHorizontal: 18, paddingVertical: 12, fontSize: 15, color: C.textPrimary },
  filterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primaryLight, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 10, gap: 5 },
  filterBtnText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  importButton: { marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: C.primary, borderRadius: RADIUS.pill, padding: 14, alignItems: 'center' },
  importButtonContent: { flexDirection: 'row', alignItems: 'center' },
  importButtonText: { color: C.primary, fontSize: 15, fontWeight: '600' },
  categoryScroll: { marginBottom: 12, flexGrow: 0, flexShrink: 0 },
  categoryScrollContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
  categoryPill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: C.bgSurface, borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start' },
  categoryPillActive: { backgroundColor: C.primary, borderColor: C.primary },
  categoryPillText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  categoryPillTextActive: { color: '#fff' },
  gridRow: { gap: 12 },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', ...(SHADOW.fab as any) },
  tabBar: { flexDirection: 'row', backgroundColor: C.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: C.primary },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  tabBtnTextActive: { color: C.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { color: C.textMuted, fontSize: 16 },
  // Grid card
  card: { flex: 1, backgroundColor: C.bgSurface, borderRadius: RADIUS.xl, marginBottom: 12, overflow: 'hidden', ...(SHADOW.sm as any) },
  cardBgArea: { height: 110, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cardBgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, resizeMode: 'cover' },
  cardBadgeFav: { position: 'absolute', top: 8, right: 8, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3 },
  cardBadgeNew: { position: 'absolute', top: 8, right: 8, backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3 },
  cardBadgeOfficial: { position: 'absolute', top: 8, left: 8, backgroundColor: C.success ?? C.primary, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3 },
  cardBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  cardShareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingTop: 4 },
  cardShareLabel: { fontSize: 11, color: C.textMuted },
  cardHeartBtn: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: RADIUS.pill, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 10 },
  cardName: { fontSize: 13, fontWeight: '600', fontFamily: FONT.serif, color: C.textPrimary, marginBottom: 4 },
  cardSubRow: { flexDirection: 'row', alignItems: 'center' },
  cardSub: { fontSize: 11, color: C.textMuted },

  // Form header
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, backgroundColor: C.bgSurface },
  formTitle: { fontSize: 17, fontWeight: '700', fontFamily: FONT.serif, color: C.textPrimary },
  formCancel: { padding: 4 },
  detailAddPlanBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 7 },
  detailAddPlanBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  formHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  aiHeaderBtnText: { fontSize: 13, fontWeight: '700', color: '#FF7043' },
  formContent: { padding: 20, backgroundColor: C.bgPage },

  // AI modal
  aiOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  aiSheet: { backgroundColor: C.bgSurface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 20, paddingBottom: 24 },
  aiSheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  aiSheetTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: C.textPrimary },
  aiSheetHint: { fontSize: 13, color: C.textSecondary, marginBottom: 12, lineHeight: 19 },
  aiInput: { backgroundColor: C.bgInput, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: 14, fontSize: 14, color: C.textPrimary, height: 90, textAlignVertical: 'top', marginBottom: 14 },
  aiGenerateBtn: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 15, alignItems: 'center' },
  aiGenerateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Photo
  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  photoBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: 12, alignItems: 'center', backgroundColor: C.bgInput },
  photoBtnContent: { flexDirection: 'row', alignItems: 'center' },
  photoBtnText: { fontSize: 14, color: C.textSecondary },
  photoPreview: { width: '100%', height: 200, borderRadius: RADIUS.md, marginBottom: 16, resizeMode: 'cover' },

  // Labels & inputs
  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  inputLabel: { fontSize: 12, color: C.textMuted, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: C.bgInput, marginBottom: 8, color: C.textPrimary },
  selectField: { justifyContent: 'center' },
  inputError: { borderColor: C.danger },
  errorText: { color: C.danger, fontSize: 12, marginTop: -4, marginBottom: 8 },
  suggestion: { backgroundColor: C.bgPage, borderRadius: RADIUS.xs, paddingHorizontal: 12, paddingVertical: 8, marginTop: 2, borderWidth: 1, borderColor: C.border },
  suggestionText: { color: C.primary, fontSize: 13 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgSurface },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, color: C.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // Row layouts
  row3: { flexDirection: 'row', gap: 8 },
  row2: { flexDirection: 'row', gap: 8 },

  // Ingredients
  ingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  ingText: { fontSize: 14, color: C.textPrimary, flex: 1 },
  ingAddRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  ingInputName: { flex: 3, marginBottom: 0 },
  ingInputQty: { flex: 1.5, marginBottom: 0 },
  ingInputUnit: { flex: 1.5, marginBottom: 0 },
  ingAddBtn: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 12 },
  ingAddBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  removeBtn: { paddingHorizontal: 8 },

  // Steps
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  stepNum: { fontSize: 15, color: C.primary, fontWeight: '700', marginTop: 13, fontFamily: FONT.serif },
  stepInput: { flex: 1, marginBottom: 0 },
  addStepBtn: { marginTop: 4, marginBottom: 8 },
  addStepBtnText: { color: C.primary, fontSize: 15, fontWeight: '600' },

  // Buttons
  saveButton: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 18, paddingHorizontal: 28, alignItems: 'center', marginTop: 28, ...(SHADOW.sm as any) },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  deleteButton: { borderWidth: 1, borderColor: C.danger, borderRadius: RADIUS.pill, paddingVertical: 16, paddingHorizontal: 28, alignItems: 'center', marginTop: 12 },
  deleteButtonText: { color: C.danger, fontSize: 15, fontWeight: '600' },
});
