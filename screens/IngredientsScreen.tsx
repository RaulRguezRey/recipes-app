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

const PURPLE = '#6200ee';

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
        <View style={styles.formCard}>
          <ScrollView>
            <Text style={styles.formTitle}>
              {ingredient ? 'Editar ingrediente' : 'Nuevo ingrediente'}
            </Text>

            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre canónico" />

            <Text style={styles.label}>Unidad por defecto</Text>
            <TextInput style={styles.input} value={defaultUnit} onChangeText={setDefaultUnit} placeholder="ud, g, ml…" />

            <Text style={styles.label}>Categoría</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowCategoryPicker(true)}>
              <Text style={{ color: category ? '#222' : '#aaa' }}>{category || 'Seleccionar…'}</Text>
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
                  <Text style={{ color: purchaseStore ? '#222' : '#aaa' }}>{purchaseStore || 'Seleccionar…'}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>

            {ingredient && onDelete && (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(ingredient.id)}>
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
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar ingrediente…"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay ingredientes</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openEdit(item)}>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  searchBar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  addBtn: { backgroundColor: PURPLE, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  list: { padding: 12, gap: 8 },
  emptyText: { color: '#aaa', textAlign: 'center', marginTop: 40 },

  row: { backgroundColor: '#fff', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  rowLeft: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#222' },
  rowCat: { fontSize: 12, color: '#888', marginTop: 2 },
  rowRight: {},
  badgeOnline: { backgroundColor: '#e8f5e9', color: '#388e3c', fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeStore: { backgroundColor: '#e3f2fd', color: '#1976d2', fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },

  // Form Modal
  formOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  formCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', padding: 20 },
  formTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#222', backgroundColor: '#fafafa' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  saveBtn: { marginTop: 20, backgroundColor: PURPLE, borderRadius: 10, padding: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteBtn: { marginTop: 10, padding: 12, alignItems: 'center' },
  deleteBtnText: { color: '#e53935', fontSize: 14 },
  cancelBtn: { padding: 12, alignItems: 'center', marginBottom: 8 },
  cancelBtnText: { color: '#888', fontSize: 14 },

  // Pickers
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerCard: { backgroundColor: '#fff', borderRadius: 14, width: '80%', overflow: 'hidden' },
  pickerRow: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerText: { fontSize: 15, color: '#333' },
  pickerTextActive: { color: PURPLE, fontWeight: '700' },
});
