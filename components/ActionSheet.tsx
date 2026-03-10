import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Action = { label: string; onPress: () => void };

type ActionSheetProps = {
  visible: boolean;
  actions: Action[];
  onClose: () => void;
};

export default function ActionSheet({ visible, actions, onClose }: ActionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          {actions.map((action, i) => (
            <TouchableOpacity key={i} style={styles.action} onPress={action.onPress}>
              <Text style={styles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 28 },
  action: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
  actionText: { fontSize: 16, color: '#333' },
  cancel: { paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  cancelText: { fontSize: 16, color: '#e53935', fontWeight: '600' },
});
