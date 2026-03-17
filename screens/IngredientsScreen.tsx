import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  addIngredient,
  deleteIngredient,
  getIngredients,
  updateIngredient,
} from '../storage/recipeStorage';
import { Ingredient } from '../types/Recipe';
import { C, FONT, RADIUS, SHADOW } from '../constants/theme';

const PURPLE = C.primary;

const CATEGORY_OPTIONS = [
  'Lácteos', 'Verduras', 'Frutas', 'Carnes', 'Pescados',
  'Legumbres', 'Cereales', 'Especias', 'Bebidas', 'Otros',
];

const STORE_OPTIONS = ['Carrefour', 'Amazon Fresh', 'Mercadona Online', 'Otro'];

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Ingredient Form Modal ────────────────────────────────────────────────────

type FormModalProps = {
  visible: boolean;
  ingredient: Ingredient | null; // null = new
  onSave: (ing: Ingredient) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
};

function IngredientFormModal({ visible, ingredient, onSave, onDelete, onClose }: FormModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [purchaseUrl, setPurchaseUrl] = useState('');
  const [purchaseStore, setPurchaseStore] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('ud');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);

  useEffect(() => {
    if (ingredient) {
      setName(ingredient.name);
      setCategory(ingredient.category ?? '');
      setIsOnline(ingredient.isOnline ?? false);
      setPurchaseUrl(ingredient.purchaseUrl ?? '');
      setPurchaseStore(ingredient.purchaseStore ?? '');
      setDefaultUnit(ingredient.defaultUnit ?? 'ud');
    } else {
      setName('');
      setCategory('');
      setIsOnline(false);
      setPurchaseUrl('');
      setPurchaseStore('');
      setDefaultUnit('ud');
    }
  }, [ingredient, visible]);

  function handleSave() {
    if (!name.trim()) return;
    const updated: Ingredient = {
      id: ingredient?.id ?? newId(),
      name: name.trim(),
      defaultUnit,
      category: category || null,
      isOnline,
      purchaseUrl: isOnline && purchaseUrl.trim() ? purchaseUrl.trim() : null,
      purchaseStore: isOnline && purchaseStore.trim() ? purchaseStore.trim() : null,
    };
    onSave(updated);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.formOverlay}>
        <View testID="ingredientForm-card" style={styles.formCard}>
          <ScrollView>
            <Text style={styles.formTitle}>
              {ingredient ? 'Editar ingrediente' : 'Nuevo ingrediente'}
            </Text>

            <Text style={styles.label}>Nombre *</Text>
            <TextInput testID="ingredientForm-nameInput" style={styles.input} value={name} onChangeText={setName} placeholder="Nombre canónico" />

            <Text style={styles.label}>Unidad por defecto</Text>
            <TextInput style={styles.input} value={defaultUnit} onChangeText={setDefaultUnit} placeholder="ud, g, ml…" />

            <Text style={styles.label}>Categoría</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowCategoryPicker(true)}>
              <Text style={{ color: category ? C.textPrimary : C.textMuted }}>{category || 'Seleccionar…'}</Text>
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Compra online</Text>
              <Switch
                value={isOnline}
                onValueChange={setIsOnline}
                trackColor={{ true: PURPLE }}
              />
            </View>

            {isOnline && (
              <>
                <Text style={styles.label}>URL de compra</Text>
                <TextInput
                  style={styles.input}
                  value={purchaseUrl}
                  onChangeText={setPurchaseUrl}
                  placeholder="https://…"
                  keyboardType="url"
                  autoCapitalize="none"
                />
                <Text style={styles.label}>Tienda</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowStorePicker(true)}>
                  <Text style={{ color: purchaseStore ? C.textPrimary : C.textMuted }}>{purchaseStore || 'Seleccionar…'}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              testID="ingredientForm-saveBtn"
              style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>

            {ingredient && onDelete && (
              <TouchableOpacity testID="ingredientForm-deleteBtn" style={styles.deleteBtn} onPress={() => onDelete(ingredient.id)}>
                <Text style={styles.deleteBtnText}>Eliminar ingrediente</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Category picker */}
      <Modal visible={showCategoryPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} onPress={() => setShowCategoryPicker(false)}>
          <View style={styles.pickerCard}>
            {CATEGORY_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt} style={styles.pickerRow} onPress={() => { setCategory(opt); setShowCategoryPicker(false); }}>
                <Text style={[styles.pickerText, category === opt && styles.pickerTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Store picker */}
      <Modal visible={showStorePicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} onPress={() => setShowStorePicker(false)}>
          <View style={styles.pickerCard}>
            {STORE_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt} style={styles.pickerRow} onPress={() => { setPurchaseStore(opt); setShowStorePicker(false); }}>
                <Text style={[styles.pickerText, purchaseStore === opt && styles.pickerTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function IngredientsScreen() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);

  const load = useCallback(async () => {
    const ings = await getIngredients();
    setIngredients(ings.sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setEditing(null);
    setModalVisible(true);
  }

  function openEdit(ing: Ingredient) {
    setEditing(ing);
    setModalVisible(true);
  }

  async function handleSave(ing: Ingredient) {
    if (editing) {
      await updateIngredient(ing);
    } else {
      await addIngredient(ing);
    }
    setModalVisible(false);
    await load();
  }

  async function handleDelete(id: string) {
    await deleteIngredient(id);
    setModalVisible(false);
    await load();
  }

  return (
    <View testID="ingredients-container" style={styles.container}>
      <View testID="ingredients-searchBar" style={styles.searchBar}>
        <TextInput
          testID="ingredients-searchInput"
          style={styles.searchInput}
          placeholder="Buscar ingrediente…"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity testID="ingredients-addBtn" style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        testID="ingredients-list"
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay ingredientes</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity testID={`ingredient-row-${item.id}`} style={styles.row} onPress={() => openEdit(item)}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowName}>{item.name}</Text>
              {item.category && <Text style={styles.rowCat}>{item.category}</Text>}
            </View>
            <View style={styles.rowRight}>
              {item.isOnline ? (
                <Text style={styles.badgeOnline}>Online</Text>
              ) : (
                <Text style={styles.badgeStore}>Tienda</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <IngredientFormModal
        visible={modalVisible}
        ingredient={editing}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPage },

  searchBar: { flexDirection: 'row', padding: 14, gap: 10, backgroundColor: C.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  searchInput: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.xl, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, backgroundColor: C.bgInput, color: C.textPrimary },
  addBtn: { backgroundColor: PURPLE, borderRadius: RADIUS.pill, paddingHorizontal: 18, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  list: { padding: 14, gap: 10 },
  emptyText: { color: C.textMuted, textAlign: 'center', marginTop: 48 },

  row: { backgroundColor: C.bgSurface, borderRadius: RADIUS.md, paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', ...(SHADOW.sm as any) },
  rowLeft: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: C.textPrimary, fontFamily: FONT.serif },
  rowCat: { fontSize: 12, color: C.textMuted, marginTop: 3 },
  rowRight: {},
  badgeOnline: { backgroundColor: C.successBg, color: C.success, fontSize: 11, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeStore: { backgroundColor: C.infoBg, color: C.info, fontSize: 11, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },

  // Form Modal
  formOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  formCard: { backgroundColor: C.bgSurface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '90%', padding: 24 },
  formTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, fontFamily: FONT.serif, color: C.textPrimary },
  label: { fontSize: 12, color: C.textSecondary, marginBottom: 5, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.textPrimary, backgroundColor: C.bgInput },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  saveBtn: { marginTop: 24, backgroundColor: PURPLE, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center', ...(SHADOW.sm as any) },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  deleteBtnText: { color: C.danger, fontSize: 14 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  cancelBtnText: { color: C.textMuted, fontSize: 14 },

  // Pickers
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  pickerCard: { backgroundColor: C.bgSurface, borderRadius: RADIUS.lg, width: '80%', overflow: 'hidden', ...(SHADOW.lg as any) },
  pickerRow: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  pickerText: { fontSize: 15, color: C.textPrimary },
  pickerTextActive: { color: PURPLE, fontWeight: '700' },
});
