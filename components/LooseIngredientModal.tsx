import { useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { C, RADIUS } from '../constants/theme';
import { Ingredient } from '../types/Recipe';

const UNITS = ['ud', 'g', 'ml', 'tsp', 'tbsp', 'kg', 'l'];

type Props = {
  visible: boolean;
  ingredients: Ingredient[];
  onConfirm: (ingredientId: string | null, name: string, quantity: number, unit: string) => void;
  onClose: () => void;
};

export default function LooseIngredientModal({ visible, ingredients, onConfirm, onClose }: Props) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('ud');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  useEffect(() => {
    if (!visible) {
      setName('');
      setQuantity('1');
      setUnit('ud');
      setSelectedId(null);
    }
  }, [visible]);

  // Autocomplete: find first ingredient whose name starts with the typed text
  const suggestion =
    name.trim().length > 0
      ? ingredients.find(
          (i) =>
            i.name.toLowerCase().startsWith(name.trim().toLowerCase()) &&
            i.name.toLowerCase() !== name.trim().toLowerCase()
        )
      : undefined;

  function handleSuggestionPress(ing: Ingredient) {
    setName(ing.name);
    setSelectedId(ing.id);
    setUnit(ing.defaultUnit ?? 'ud');
  }

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Falta el nombre', 'Escribe el nombre del ingrediente.');
      return;
    }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      Alert.alert('Cantidad inválida', 'Introduce una cantidad mayor que 0.');
      return;
    }

    // Check if user typed an exact existing ingredient name
    const exactMatch = ingredients.find(
      (i) => i.name.toLowerCase() === trimmed.toLowerCase()
    );
    const resolvedId = selectedId ?? exactMatch?.id ?? null;

    onConfirm(resolvedId, trimmed, qty, unit);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.card} activeOpacity={1}>
          <Text style={s.title}>Añadir ingrediente</Text>

          {/* Name input */}
          <Text style={s.label}>NOMBRE</Text>
          <TextInput
            style={s.input}
            placeholder="Ej: Plátano, Leche entera…"
            placeholderTextColor={C.textMuted}
            value={name}
            onChangeText={(t) => { setName(t); setSelectedId(null); }}
            autoFocus
          />
          {suggestion && (
            <TouchableOpacity style={s.suggestion} onPress={() => handleSuggestionPress(suggestion)}>
              <Text style={s.suggestionText}>{suggestion.name}</Text>
            </TouchableOpacity>
          )}

          {/* Quantity + unit */}
          <View style={s.qtyRow}>
            <View style={s.qtyBox}>
              <Text style={s.label}>CANTIDAD</Text>
              <TextInput
                style={[s.input, { marginBottom: 0 }]}
                placeholder="1"
                placeholderTextColor={C.textMuted}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={s.unitBox}>
              <Text style={s.label}>UNIDAD</Text>
              <TouchableOpacity
                style={[s.input, s.unitBtn]}
                onPress={() => setShowUnitPicker((v) => !v)}
              >
                <Text style={s.unitBtnText}>{unit}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Unit picker */}
          {showUnitPicker && (
            <View style={s.unitPicker}>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[s.unitOption, u === unit && s.unitOptionActive]}
                  onPress={() => { setUnit(u); setShowUnitPicker(false); }}
                >
                  <Text style={[s.unitOptionText, u === unit && s.unitOptionTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm}>
            <Text style={s.confirmText}>Añadir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card: { backgroundColor: C.bgSurface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 24, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', color: C.textPrimary, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: C.bgInput, marginBottom: 12, color: C.textPrimary },
  suggestion: { backgroundColor: C.bgPage, borderRadius: RADIUS.xs, paddingHorizontal: 12, paddingVertical: 8, marginTop: -8, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  suggestionText: { color: C.primary, fontSize: 13 },
  qtyRow: { flexDirection: 'row', gap: 12 },
  qtyBox: { flex: 2 },
  unitBox: { flex: 1 },
  unitBtn: { justifyContent: 'center', marginBottom: 0 },
  unitBtnText: { fontSize: 15, color: C.textPrimary, fontWeight: '600' },
  unitPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  unitOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgPage },
  unitOptionActive: { backgroundColor: C.primary, borderColor: C.primary },
  unitOptionText: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  unitOptionTextActive: { color: '#fff' },
  confirmBtn: { backgroundColor: C.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: C.textMuted, fontSize: 15 },
});
