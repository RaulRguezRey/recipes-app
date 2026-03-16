import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Home, BookOpen, CalendarDays, BarChart2, User, Bell, Search } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, FONT, RADIUS, SHADOW } from './constants/theme';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/auth/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import RecipesScreen from './screens/RecipesScreen';
import PlanningScreen from './screens/PlanningScreen';
import ShoppingListScreen from './screens/ShoppingListScreen';
import NutritionScreen from './screens/NutritionScreen';
import IngredientsScreen from './screens/IngredientsScreen';
import SettingsScreen from './screens/SettingsScreen';

type Tab = 'Home' | 'Recipes' | 'Planning' | 'Nutrition' | 'Settings';
type Screen = Tab | 'Shopping List' | 'Ingredients';
type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const TABS: { name: Tab; lucideIcon: LucideIcon; label: string }[] = [
  { name: 'Home',      lucideIcon: Home,         label: 'Inicio'     },
  { name: 'Recipes',   lucideIcon: BookOpen,     label: 'Recetas'    },
  { name: 'Planning',  lucideIcon: CalendarDays, label: 'Planificar' },
  { name: 'Nutrition', lucideIcon: BarChart2,    label: 'Nutrición'  },
  { name: 'Settings',  lucideIcon: User,         label: 'Perfil'     },
];

const SCREEN_TITLES: Partial<Record<Screen, string>> = {
  Recipes:        'Recetas',
  Planning:       'Mi Planificación',
  'Shopping List':'Lista de la compra',
  Nutrition:      'Nutrición',
  Settings:       'Perfil',
  Ingredients:    'Ingredientes',
};

// ── App Header ─────────────────────────────────────────────────────────────────

function AppHeader({ currentScreen }: { currentScreen: Screen }) {
  const { profile } = useAuth();
  const firstName = profile?.display_name?.split(' ')[0] ?? 'Chef';
  const isHome = currentScreen === 'Home';

  return (
    <View style={[hStyles.header, isHome && hStyles.headerHome]}>
      <View style={hStyles.topRow}>
        {isHome
          ? <Text style={hStyles.logo}>Nutri<Text style={hStyles.logoAccent}>Plato</Text></Text>
          : <Text style={hStyles.screenTitle}>{SCREEN_TITLES[currentScreen] ?? ''}</Text>
        }
        <View style={hStyles.iconRow}>
          <TouchableOpacity style={hStyles.iconBtn}>
            <Bell size={16} color="#fff" strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity style={hStyles.iconBtn}>
            <User size={16} color="#fff" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      {isHome && (
        <>
          <Text style={hStyles.greeting}>Buenos días,</Text>
          <Text style={hStyles.userName}>{firstName}</Text>
          <View style={hStyles.searchBar}>
            <Search size={16} color={C.textSecondary} strokeWidth={1.8} />
            <Text style={hStyles.searchPlaceholder}>Buscar recetas, ingredientes…</Text>
          </View>
        </>
      )}
    </View>
  );
}

const hStyles = StyleSheet.create({
  header: {
    backgroundColor: C.primaryDark,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerHome: { paddingBottom: 20 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  logo: { fontFamily: FONT.serif, color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  logoAccent: { color: '#FFD54F' },
  screenTitle: { fontFamily: FONT.serif, color: '#fff', fontSize: 20, fontWeight: '700' },
  iconRow: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 34, height: 34, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  greeting: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 8, marginBottom: 2 },
  userName: { color: '#fff', fontSize: 19, fontWeight: '700', marginBottom: 14 },
  searchBar: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    ...(SHADOW.sm as any),
  },
  searchPlaceholder: { color: C.textMuted, fontSize: 14, flex: 1 },
});

// ── Loading ────────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bgPage, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  );
}

// ── Main tabs ──────────────────────────────────────────────────────────────────

function MainTabs() {
  const insets = useSafeAreaInsets();
  const [currentScreen, setCurrentScreen] = useState<Screen>('Home');
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  function handleGenerateList(planId: string) {
    setActivePlanId(planId);
    setCurrentScreen('Shopping List');
  }

  function renderScreen() {
    switch (currentScreen) {
      case 'Home':
        return <HomeScreen onNavigate={(s) => setCurrentScreen(s as Screen)} />;
      case 'Recipes':
        return <RecipesScreen />;
      case 'Planning':
        return <PlanningScreen onGenerateList={handleGenerateList} />;
      case 'Shopping List':
        return <ShoppingListScreen activePlanId={activePlanId} />;
      case 'Nutrition':
        return <NutritionScreen activePlanId={activePlanId} />;
      case 'Ingredients':
        return <IngredientsScreen />;
      case 'Settings':
        return <SettingsScreen onOpenIngredients={() => setCurrentScreen('Ingredients')} />;
    }
  }

  const activeTab: Tab = (
    currentScreen === 'Ingredients' ? 'Settings' :
    currentScreen === 'Shopping List' ? 'Planning' :
    currentScreen as Tab
  );

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      {/* Status bar area — green */}
      <View style={{ height: insets.top, backgroundColor: C.primaryDark }} />
      <AppHeader currentScreen={currentScreen} />
      <View style={{ flex: 1, backgroundColor: C.bgPage }}>
        {renderScreen()}
      </View>
      {/* Tab bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => setCurrentScreen(tab.name)}
            >
              <tab.lucideIcon
                size={22}
                color={active ? C.primary : C.textMuted}
                strokeWidth={active ? 2.2 : 1.6}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              {active && <View style={styles.tabDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Auth wrapper ───────────────────────────────────────────────────────────────

function AppContent() {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  return <MainTabs />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    ...(SHADOW.up as any),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 9.5,
    color: C.textMuted,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: C.primary,
    fontWeight: '700',
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.primary,
    marginTop: 1,
  },
});
