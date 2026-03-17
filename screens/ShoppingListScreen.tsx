import { ShoppingCart, ShoppingBag, Store, Check } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAllAccessibleRecipes, getIngredients } from '../storage/recipeStorage';
import { getEntriesForPlan } from '../storage/mealPlanStorage';
import {
  generateShoppingList,
  getShoppingListForPlan,
  saveShoppingList,
  updateShoppingListItem,
} from '../storage/shoppingListStorage';
import { ShoppingList, ShoppingListItem } from '../types/Recipe';
import { C, RADIUS, SHADOW } from '../constants/theme';

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
    <TouchableOpacity testID={`shopping-item-${item.id}`} style={styles.itemRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, item.isChecked && styles.checkboxChecked]}>
        {item.isChecked && <Check size={14} color="#fff" strokeWidth={2.5} />}
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
        getAllAccessibleRecipes(),
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
        <TouchableOpacity testID="shopping-generateBtn" style={styles.generateBtn} onPress={handleGenerate} disabled={loading}>
          {loading ? (
            <Text style={styles.generateBtnText}>Generando…</Text>
          ) : (
            <View style={styles.generateBtnContent}>
              <ShoppingCart size={18} color="#fff" strokeWidth={1.8} />
              <Text style={styles.generateBtnText}> Generar lista</Text>
            </View>
          )}
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
    <View testID="shopping-container" style={styles.container}>
      {/* Header bar */}
      <View testID="shopping-header" style={styles.header}>
        <Text style={styles.headerProgress}>{checkedCount}/{totalCount} ítems</Text>
        <TouchableOpacity onPress={handleGenerate} disabled={loading}>
          <Text style={styles.headerRegen}>{loading ? '…' : '↺ Regenerar'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView testID="shopping-scroll" contentContainerStyle={styles.scroll}>
        {/* ONLINE block */}
        {onlineItems.length > 0 && (
          <View testID="shopping-onlineBlock" style={styles.block}>
            <View style={styles.blockTitleRow}>
              <ShoppingBag size={13} color={C.primary} strokeWidth={1.8} />
              <Text style={styles.blockTitle}> COMPRA ONLINE ({onlineItems.length})</Text>
            </View>
            {onlineItems.map((item) => (
              <ItemRow key={item.id} item={item} onToggle={() => toggleItem(item.id)} showUrl />
            ))}
          </View>
        )}

        {/* SUPERMERCADO block */}
        {offlineItems.length > 0 && (
          <View testID="shopping-offlineBlock" style={styles.block}>
            <View style={styles.blockTitleRow}>
              <Store size={13} color={C.primary} strokeWidth={1.8} />
              <Text style={styles.blockTitle}> SUPERMERCADO ({offlineItems.length})</Text>
            </View>
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: C.bgPage },
  emptyText: { color: C.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  generateBtn: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 16, paddingHorizontal: 36, alignItems: 'center', ...(SHADOW.sm as any) },
  generateBtnContent: { flexDirection: 'row', alignItems: 'center' },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.bgSurface, paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  headerProgress: { fontSize: 14, color: C.textSecondary, fontWeight: '500' },
  headerRegen: { fontSize: 14, color: C.primary, fontWeight: '600' },

  scroll: { padding: 14, gap: 14 },
  block: { backgroundColor: C.bgSurface, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 14, ...(SHADOW.sm as any) },
  blockTitleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, paddingVertical: 12, paddingHorizontal: 16 },
  blockTitle: { fontSize: 12, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.8 },

  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: C.bgInput, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  categoryChevron: { fontSize: 11, color: C.textMuted },

  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  checkbox: { width: 24, height: 24, borderRadius: RADIUS.pill, borderWidth: 2, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center', marginRight: 14, marginTop: 1 },
  checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },
  itemContent: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
  itemNameChecked: { textDecorationLine: 'line-through', color: C.textMuted },
  itemQty: { fontSize: 13, color: C.textSecondary, marginTop: 3 },
  itemOrigins: { fontSize: 11, color: C.textMuted, marginTop: 3 },
  itemUrl: { fontSize: 12, color: C.primary, marginTop: 5, fontWeight: '600' },
});
