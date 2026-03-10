import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollView as ScrollViewType,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ActionSheet from '../components/ActionSheet';
import SelectModal from '../components/SelectModal';
import { addIngredient, addOrigin, addRecipe, deleteRecipe, getIngredients, getOrigins, getRecipes, updateRecipe } from '../storage/recipeStorage';
import { Difficulty, Ingredient, MealType, Recipe, RecipeIngredient } from '../types/Recipe';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const UNITS = ['g', 'ud', 'ml', 'tsp', 'tbsp'];
const PREDEFINED_ORIGINS = ['Italiana', 'Mexicana', 'Española', 'Asiática', 'Francesa', 'Americana', 'Árabe', 'India', 'Japonesa', 'Griega'];

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Hard',
};

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: '☀️ Breakfast',
  lunch: '🍱 Lunch',
  snack: '🍎 Snack',
  dinner: '🌙 Dinner',
};

// ─── Recipe List ──────────────────────────────────────────────────────────────

type ListViewProps = {
  recipes: Recipe[];
  onAdd: () => void;
  onSelect: (recipe: Recipe) => void;
  onToggleFavorite: (recipe: Recipe) => void;
};

function ListView({ recipes, onAdd, onSelect, onToggleFavorite }: ListViewProps) {
  return (
    <View style={styles.flex}>
      <TouchableOpacity style={styles.addButton} onPress={onAdd}>
        <Text style={styles.addButtonText}>+ Add Recipe</Text>
      </TouchableOpacity>

      {recipes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No recipes yet. Add your first one!</Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => onSelect(item)}>
              {item.photoUri && (
                <Image source={{ uri: item.photoUri }} style={styles.cardImage} />
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  <TouchableOpacity onPress={() => onToggleFavorite(item)}>
                    <Text style={styles.star}>{item.isFavorite ? '⭐' : '☆'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.tag}>{MEAL_LABEL[item.mealType]}</Text>
                  <Text style={styles.tag}>{DIFFICULTY_LABEL[item.difficulty]}</Text>
                </View>
                <Text style={styles.cardSub}>
                  ⏱ {item.prepTime + item.cookTime} min · {item.servings} servings · {item.caloriesPerServing} kcal
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
      {/* Header */}
      <View style={styles.formHeader}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.formCancel}>✕ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>{isEdit ? 'Edit Recipe' : 'New Recipe'}</Text>
        <TouchableOpacity onPress={() => setIsFavorite(!isFavorite)}>
          <Text style={styles.star}>{isFavorite ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.formContent}>

        {/* Photo */}
        <Text style={styles.sectionLabel}>Photo</Text>
        <TouchableOpacity style={styles.photoBtn} onPress={() => setShowPhotoSheet(true)}>
          <Text style={styles.photoBtnText}>📷 Add photo</Text>
        </TouchableOpacity>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.photoPreview} />}
        <ActionSheet
          visible={showPhotoSheet}
          onClose={() => setShowPhotoSheet(false)}
          actions={[
            { label: '📷 Choose from gallery', onPress: () => { setShowPhotoSheet(false); pickImage('gallery'); } },
            { label: '📸 Take a photo', onPress: () => { setShowPhotoSheet(false); pickImage('camera'); } },
          ]}
        />

        {/* Basic info */}
        <Text style={styles.sectionLabel}>Name *</Text>
        <TextInput
          style={[styles.input, nameError && styles.inputError]}
          value={name}
          onChangeText={(v) => { setName(v); if (v.trim()) setNameError(false); }}
          placeholder="Recipe name"
        />
        {nameError && <Text style={styles.errorText}>Name is required</Text>}

        <Text style={styles.sectionLabel}>Origin</Text>
        <TouchableOpacity style={[styles.input, styles.selectField]} onPress={() => setShowOriginModal(true)}>
          <Text style={{ color: origin ? '#000' : '#aaa', fontSize: 15 }}>{origin || 'Select origin...'}</Text>
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
              <Text style={styles.ingAddBtnText}>✓</Text>
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
            <TouchableOpacity onPress={() => removeIngredient(i)}>
              <Text style={styles.removeBtn}>✕</Text>
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
            <TouchableOpacity onPress={() => removeStep(i)}>
              <Text style={styles.removeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addStepBtn} onPress={addStep}>
          <Text style={styles.addStepBtnText}>+ Add step</Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{isEdit ? 'Save changes' : 'Save recipe'}</Text>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete recipe</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const loadData = useCallback(async () => {
    setRecipes(await getRecipes());
    setAllIngredients(await getIngredients());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSave(recipe: Recipe) {
    if (editingRecipe) {
      await updateRecipe(recipe);
    } else {
      await addRecipe(recipe);
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

  function openAdd() {
    setEditingRecipe(null);
    setView('form');
  }

  function openEdit(recipe: Recipe) {
    setEditingRecipe(recipe);
    setView('form');
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
    <ListView
      recipes={recipes}
      onAdd={openAdd}
      onSelect={openEdit}
      onToggleFavorite={handleToggleFavorite}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PURPLE = '#6200ee';

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // List
  addButton: { margin: 16, backgroundColor: PURPLE, borderRadius: 10, padding: 14, alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { color: '#aaa', fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee', elevation: 2, boxShadow: '0px 2px 4px rgba(0,0,0,0.06)' } as any,
  cardImage: { width: '100%', height: 140, resizeMode: 'cover' },
  cardBody: { padding: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardName: { fontSize: 17, fontWeight: '600', flex: 1 },
  star: { fontSize: 20, marginLeft: 8 },
  cardMeta: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tag: { fontSize: 12, color: '#555', backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  cardSub: { fontSize: 12, color: '#888', marginTop: 4 },

  // Form header
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  formTitle: { fontSize: 17, fontWeight: '700' },
  formCancel: { color: PURPLE, fontSize: 15 },
  formContent: { padding: 16 },

  // Photo
  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  photoBtn: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, alignItems: 'center' },
  photoBtnText: { fontSize: 14, color: '#444' },
  photoPreview: { width: '100%', height: 180, borderRadius: 10, marginBottom: 16, resizeMode: 'cover' },

  // Labels & inputs
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  inputLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 8 },
  selectField: { justifyContent: 'center' },
  inputError: { borderColor: '#e53935' },
  errorText: { color: '#e53935', fontSize: 12, marginTop: -4, marginBottom: 8 },
  suggestion: { backgroundColor: '#f0e8ff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginTop: 2 },
  suggestionText: { color: '#6200ee', fontSize: 13 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#f5f5f5' },
  chipActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  chipText: { fontSize: 13, color: '#444' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // Row layouts
  row3: { flexDirection: 'row', gap: 8 },
  row2: { flexDirection: 'row', gap: 8 },

  // Ingredients
  ingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  ingText: { fontSize: 14, color: '#333', flex: 1 },
  ingAddRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  ingInputName: { flex: 3, marginBottom: 0 },
  ingInputQty: { flex: 1.5, marginBottom: 0 },
  ingInputUnit: { flex: 1.5, marginBottom: 0 },
  ingAddBtn: { backgroundColor: PURPLE, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  ingAddBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  removeBtn: { color: '#e53935', fontSize: 16, paddingHorizontal: 8 },

  // Steps
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  stepNum: { fontSize: 15, color: PURPLE, fontWeight: '700', marginTop: 11 },
  stepInput: { flex: 1, marginBottom: 0 },
  addStepBtn: { marginTop: 4, marginBottom: 8 },
  addStepBtnText: { color: PURPLE, fontSize: 15, fontWeight: '600' },

  // Buttons
  saveButton: { backgroundColor: PURPLE, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: { borderWidth: 1, borderColor: '#e53935', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  deleteButtonText: { color: '#e53935', fontSize: 15, fontWeight: '600' },
});
