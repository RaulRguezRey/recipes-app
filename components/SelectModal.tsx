import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, FONT, RADIUS, SHADOW } from '../constants/theme';

export type SelectOption = { label: string; value: string };

type SelectModalProps = {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  addNewLabel?: string;
  onAddNew?: () => void;
};

export default function SelectModal({
  visible, title, options, selectedValue, onSelect, onClose, addNewLabel, onAddNew,
}: SelectModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity testID="selectModal-overlay" style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity testID="selectModal-card" style={styles.card} activeOpacity={1}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            testID="selectModal-list"
            data={options}
            keyExtractor={(item) => item.value}
            style={styles.list}
            renderItem={({ item }) => {
              const active = item.value === selectedValue;
              return (
                <TouchableOpacity
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => onSelect(item.value)}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListFooterComponent={
              addNewLabel && onAddNew ? (
                <TouchableOpacity style={styles.addNew} onPress={onAddNew}>
                  <Text style={styles.addNewText}>{addNewLabel}</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: C.bgSurface, borderRadius: RADIUS.xl, width: '85%', maxHeight: '70%', overflow: 'hidden', ...(SHADOW.lg as any) },
  title: { fontSize: 16, fontWeight: '700', paddingVertical: 18, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, fontFamily: FONT.serif, color: C.textPrimary },
  list: { flexGrow: 0 },
  option: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  optionActive: { backgroundColor: C.primary },
  optionText: { fontSize: 15, color: C.textPrimary },
  optionTextActive: { color: '#fff', fontWeight: '600' },
  addNew: { paddingVertical: 15, paddingHorizontal: 20 },
  addNewText: { fontSize: 15, color: C.primary, fontWeight: '600' },
});
