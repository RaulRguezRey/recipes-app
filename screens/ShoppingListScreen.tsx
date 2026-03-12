import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getIngredients, getRecipes } from '../storage/recipeStorage';
import { getEntriesForPlan } from '../storage/mealPlanStorage';
import {
  generateShoppingList,
  getShoppingListForPlan,
  saveShoppingList,
  updateShoppingListItem,
} from '../storage/shoppingListStorage';
import { ShoppingList, ShoppingListItem } from '../types/Recipe';
import { C } from '../constants/theme';

function formatQty(qty: number, unit: string): string {
  if (Number.isInteger(qty)) return `${qty} ${unit}`;
  return `${qty.toFixed(unit === 'tsp' || unit === 'tbsp' ? 1 : 0)} ${unit}`;
}

type ItemRowProps = {
  item: ShoppingListItem;
  onToggle: () => void;
  showUrl?: boolean;
};

function ItemRow({ item, onToggle, showUrl }: ItemRowProps) {
  const origins = item.originRecipes.map((o) => o.recipeName).join(', ');

  return (
    <TouchableOpacity style={styles.itemRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, item.isChecked && styles.checkboxChecked]}>
        {item.isChecked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, item.isChecked && styles.itemNameChecked]}>
          {item.name}
        </Text>
        <Text style={styles.itemQty}>
          {formatQty(item.quantity, item.unit)}
        </Text>
        {origins ? <Text style={styles.itemOrigins}>{origins}</Text> : null}
        {showUrl && item.purchaseUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(item.purchaseUrl!)}>
            <Text style={styles.itemUrl}>Abrir en tienda →</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

type Props = {
  activePlanId: string | null;
};

export default function ShoppingListScreen({ activePlanId }: Props) {
  const [list, setList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!activePlanId) return;
    const existing = await getShoppingListForPlan(activePlanId);
    setList(existing);
  }, [activePlanId]);

  useEffect(() => { load(); }, [load]);

  async function handleGenerate() {
    if (!activePlanId) return;
    setLoading(true);
    try {
      const [entries, recipes, ingredients] = await Promise.all([
        getEntriesForPlan(activePlanId),
        getRecipes(),
        getIngredients(),
      ]);
      const newList = generateShoppingList(activePlanId, entries, recipes, ingredients);
      await saveShoppingList(newList);
      setList(newList);
    } finally {
      setLoading(false);
    }
  }

  async function toggleItem(itemId: string) {
    if (!list) return;
    const item = list.items.find((i) => i.id === itemId);
    if (!item) return;
    const updated = { ...item, isChecked: !item.isChecked };
    const newItems = list.items.map((i) => (i.id === itemId ? updated : i));
    const newList = { ...list, items: newItems };
    setList(newList);
    await updateShoppingListItem(list.id, itemId, { isChecked: updated.isChecked });
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  if (!activePlanId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Crea un planning primero para generar la lista.</Text>
      </View>
    );
  }

  if (!list) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Genera la lista de la compra a partir del planning activo.
        </Text>
        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={loading}>
          <Text style={styles.generateBtnText}>
            {loading ? 'Generando…' : '🛒 Generar lista'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onlineItems = list.items.filter((i) => i.isOnline);
  const offlineItems = list.items.filter((i) => !i.isOnline);

  // Group offline items by category
  const categoryGroups: Record<string, ShoppingListItem[]> = {};
  for (const item of offlineItems) {
    const cat = item.category ?? 'Sin categoría';
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    categoryGroups[cat].push(item);
  }

  const checkedCount = list.items.filter((i) => i.isChecked).length;
  const totalCount = list.items.length;

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <Text style={styles.headerProgress}>{checkedCount}/{totalCount} ítems</Text>
        <TouchableOpacity onPress={handleGenerate} disabled={loading}>
          <Text style={styles.headerRegen}>{loading ? '…' : '↺ Regenerar'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ONLINE block */}
        {onlineItems.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>🛍 COMPRA ONLINE ({onlineItems.length})</Text>
            {onlineItems.map((item) => (
              <ItemRow key={item.id} item={item} onToggle={() => toggleItem(item.id)} showUrl />
            ))}
          </View>
        )}

        {/* SUPERMERCADO block */}
        {offlineItems.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>🏪 SUPERMERCADO ({offlineItems.length})</Text>
            {Object.entries(categoryGroups).map(([cat, items]) => (
              <View key={cat}>
                <TouchableOpacity
                  style={styles.categoryHeader}
                  onPress={() => toggleCategory(cat)}
                >
                  <Text style={styles.categoryLabel}>{cat}</Text>
                  <Text style={styles.categoryChevron}>
                    {collapsedCategories.has(cat) ? '▶' : '▼'}
                  </Text>
                </TouchableOpacity>
                {!collapsedCategories.has(cat) &&
                  items.map((item) => (
                    <ItemRow key={item.id} item={item} onToggle={() => toggleItem(item.id)} />
                  ))}
              </View>
            ))}
          </View>
        )}

        {list.items.length === 0 && (
          <Text style={styles.emptyText}>
            No hay ingredientes en el planning.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPage },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: C.bgPage },
  emptyText: { color: C.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 24 },
  generateBtn: { backgroundColor: C.primary, borderRadius: 10, padding: 14, paddingHorizontal: 28 },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.bgSurface, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerProgress: { fontSize: 14, color: C.textSecondary },
  headerRegen: { fontSize: 14, color: C.primary, fontWeight: '600' },

  scroll: { padding: 12, gap: 12 },
  block: { backgroundColor: C.bgSurface, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  blockTitle: { fontSize: 13, fontWeight: '700', color: C.primary, backgroundColor: C.bgPage, padding: 12 },

  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: C.bgInput, borderTopWidth: 1, borderTopColor: C.border },
  categoryLabel: { fontSize: 13, fontWeight: '600', color: C.textSecondary, textTransform: 'uppercase' },
  categoryChevron: { fontSize: 11, color: C.textMuted },

  itemRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderTopWidth: 1, borderTopColor: C.border },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1 },
  checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  itemContent: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
  itemNameChecked: { textDecorationLine: 'line-through', color: C.textMuted },
  itemQty: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  itemOrigins: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  itemUrl: { fontSize: 12, color: C.primary, marginTop: 4, fontWeight: '600' },
});
