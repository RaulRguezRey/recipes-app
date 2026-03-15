import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, RADIUS } from '../constants/theme';

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
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bgSurface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingBottom: 32 },
  action: { paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, alignItems: 'center' },
  actionText: { fontSize: 16, color: C.textPrimary, fontWeight: '500' },
  cancel: { paddingVertical: 18, alignItems: 'center', marginTop: 6 },
  cancelText: { fontSize: 16, color: C.danger, fontWeight: '600' },
});
