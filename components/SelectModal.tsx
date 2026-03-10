import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PURPLE = '#6200ee';

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
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, width: '85%', maxHeight: '70%', overflow: 'hidden' },
  title: { fontSize: 16, fontWeight: '700', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  list: { flexGrow: 0 },
  option: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionActive: { backgroundColor: PURPLE },
  optionText: { fontSize: 15, color: '#333' },
  optionTextActive: { color: '#fff', fontWeight: '600' },
  addNew: { paddingVertical: 14, paddingHorizontal: 16 },
  addNewText: { fontSize: 15, color: PURPLE, fontWeight: '600' },
});
