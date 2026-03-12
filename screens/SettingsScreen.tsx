import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type SettingRowProps = {
  label: string;
  value?: string;
  onPress?: () => void;
};

function SettingRow({ label, value, onPress }: SettingRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

type Props = {
  onOpenIngredients: () => void;
};

export default function SettingsScreen({ onOpenIngredients }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Section title="Profile">
        <SettingRow label="Username" />
        <SettingRow label="Household size" value="2 people" />
      </Section>

      <Section title="Preferences">
        <SettingRow label="Units" value="Metric" />
        <SettingRow label="Dietary restrictions" value="None" />
        <SettingRow label="Favorite cuisine" />
      </Section>

      <Section title="Appearance">
        <SettingRow label="Theme" value="Light" />
        <SettingRow label="Language" value="English" />
      </Section>

      <Section title="Notifications">
        <SettingRow label="Weekly planning reminder" />
        <SettingRow label="Shopping list reminder" />
      </Section>

      <Section title="Catalogue">
        <SettingRow label="Ingredient catalogue" onPress={onOpenIngredients} />
      </Section>

      <Section title="Data">
        <SettingRow label="Export data" />
        <SettingRow label="Import recipes" />
        <SettingRow label="Reset / Clear all data" />
      </Section>

      <Section title="About">
        <SettingRow label="App version" value="1.0.0" />
        <SettingRow label="Privacy policy" />
      </Section>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  content: {
    paddingVertical: 24,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b6b6b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionBody: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  rowLabel: {
    fontSize: 16,
    color: '#1c1c1e',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    fontSize: 16,
    color: '#8e8e93',
  },
  chevron: {
    fontSize: 18,
    color: '#c7c7cc',
    marginLeft: 2,
  },
});
