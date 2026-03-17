import { useState } from 'react';
import {
  Alert,
  Clipboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getHouseholdMembers, HouseholdMember } from '../storage/householdStorage';
import { C, FONT, RADIUS, SHADOW } from '../constants/theme';

// ── Reusable sub-components ───────────────────────────────────────────────────

type SettingRowProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
};

function SettingRow({ label, value, onPress, danger }: SettingRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <Text style={[styles.rowLabel, danger && { color: C.danger }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {onPress && <Text style={styles.chevron}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

type SectionProps = { title: string; children: React.ReactNode };

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// ── Household modals ─────────────────────────────────────────────────────────

function CreateHouseholdModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { createHousehold } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    if (!name.trim()) { setError('Introduce un nombre para el hogar.'); return; }
    setLoading(true); setError(null);
    try {
      await createHousehold(name.trim());
      setName('');
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View testID="settings-createHouseholdCard" style={styles.modalCard}>
          <Text style={styles.modalTitle}>Crear hogar</Text>
          <TextInput
            testID="settings-householdNameInput"
            style={styles.modalInput}
            placeholder="Nombre del hogar (ej: Casa de Raúl y Moni)"
            placeholderTextColor={C.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          {error && <Text style={styles.modalError}>{error}</Text>}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
              <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnPrimary, loading && { opacity: 0.6 }]}
              onPress={handle}
              disabled={loading}
            >
              <Text style={styles.modalBtnPrimaryText}>Crear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function JoinHouseholdModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { joinHousehold } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    if (!code.trim()) { setError('Introduce el código del hogar.'); return; }
    setLoading(true); setError(null);
    try {
      await joinHousehold(code.trim().toUpperCase());
      setCode('');
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View testID="settings-joinHouseholdCard" style={styles.modalCard}>
          <Text style={styles.modalTitle}>Unirse a un hogar</Text>
          <Text style={styles.modalSubtitle}>
            Pide a tu pareja o compañero el código de su hogar e introdúcelo aquí.
          </Text>
          <TextInput
            testID="settings-householdCodeInput"
            style={[styles.modalInput, styles.codeInput]}
            placeholder="ABCD-1234"
            placeholderTextColor={C.textMuted}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />
          {error && <Text style={styles.modalError}>{error}</Text>}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
              <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnPrimary, loading && { opacity: 0.6 }]}
              onPress={handle}
              disabled={loading}
            >
              <Text style={styles.modalBtnPrimaryText}>Unirse</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type Props = { onOpenIngredients: () => void };

export default function SettingsScreen({ onOpenIngredients }: Props) {
  const { user, profile, household, signOut, leaveHousehold } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [showMembers, setShowMembers] = useState(false);

  async function handleViewMembers() {
    if (!household) return;
    const m = await getHouseholdMembers(household.id);
    setMembers(m);
    setShowMembers(true);
  }

  function handleCopyCode() {
    if (!household) return;
    Clipboard.setString(household.code);
    Alert.alert('Copiado', `Código "${household.code}" copiado al portapapeles.`);
  }

  function handleLeave() {
    Alert.alert(
      'Salir del hogar',
      '¿Seguro que quieres salir? Dejarás de ver las recetas compartidas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            try { await leaveHousehold(); }
            catch (e: any) { Alert.alert('Error', e.message); }
          },
        },
      ]
    );
  }

  function handleSignOut() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
    ]);
  }


  return (
    <>
      <ScrollView testID="settings-scroll" style={styles.container} contentContainerStyle={styles.content}>

        {/* Account */}
        <Section title="Cuenta">
          <SettingRow label="Nombre" value={profile?.display_name ?? '—'} />
          <SettingRow label="Email" value={user?.email ?? '—'} />
          <SettingRow label="Cerrar sesión" onPress={handleSignOut} danger />
        </Section>

        {/* Household */}
        <Section title="Hogar">
          {household ? (
            <>
              <SettingRow label="Nombre del hogar" value={household.name} />
              <SettingRow
                label="Código de invitación"
                value={household.code}
                onPress={handleCopyCode}
              />
              <SettingRow label="Miembros" onPress={handleViewMembers} />
              <SettingRow label="Salir del hogar" onPress={handleLeave} danger />
            </>
          ) : (
            <>
              <SettingRow label="Crear hogar" onPress={() => setShowCreate(true)} />
              <SettingRow label="Unirse con código" onPress={() => setShowJoin(true)} />
            </>
          )}
        </Section>

        {/* Catalogue */}
        <Section title="Catálogo">
          <SettingRow label="Catálogo de ingredientes" onPress={onOpenIngredients} />
        </Section>

        {/* About */}
        <Section title="Acerca de">
          <SettingRow label="Versión de la app" value="1.0.0" />
        </Section>

      </ScrollView>

      {/* Members modal */}
      <Modal visible={showMembers} transparent animationType="fade" onRequestClose={() => setShowMembers(false)}>
        <View style={styles.modalOverlay}>
          <View testID="settings-membersCard" style={styles.modalCard}>
            <Text style={styles.modalTitle}>Miembros del hogar</Text>
            {members.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <Text style={styles.memberName}>{m.display_name ?? m.id}</Text>
                {m.id === user?.id && <Text style={styles.memberYou}>(tú)</Text>}
              </View>
            ))}
            <TouchableOpacity style={[styles.modalBtnPrimary, { marginTop: 16 }]} onPress={() => setShowMembers(false)}>
              <Text style={styles.modalBtnPrimaryText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CreateHouseholdModal visible={showCreate} onClose={() => setShowCreate(false)} />
      <JoinHouseholdModal visible={showJoin} onClose={() => setShowJoin(false)} />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgPage,
  },
  content: {
    paddingVertical: 28,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionBody: {
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...(SHADOW.sm as any),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  rowLabel: {
    fontSize: 16,
    color: C.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 15,
    color: C.textSecondary,
  },
  chevron: {
    fontSize: 18,
    color: C.borderStrong,
    marginLeft: 2,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.lg,
    padding: 24,
    width: '100%',
    ...(SHADOW.lg as any),
  },
  modalTitle: {
    fontFamily: FONT.serif,
    fontSize: 20,
    color: C.textPrimary,
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: C.bgInput,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.textPrimary,
    marginBottom: 8,
  },
  codeInput: {
    fontFamily: FONT.serif,
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
  },
  modalError: {
    color: C.danger,
    fontSize: 13,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  modalBtnSecondaryText: {
    color: C.textSecondary,
    fontWeight: '600',
  },
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  memberName: {
    fontSize: 16,
    color: C.textPrimary,
  },
  memberYou: {
    fontSize: 13,
    color: C.textMuted,
  },
});
