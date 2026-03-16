import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Home, Utensils, CalendarDays, BarChart2, Settings } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { C, SHADOW } from './constants/theme';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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

const TABS: { name: Tab; lucideIcon: LucideIcon }[] = [
  { name: 'Home',      lucideIcon: Home         },
  { name: 'Recipes',   lucideIcon: Utensils     },
  { name: 'Planning',  lucideIcon: CalendarDays },
  { name: 'Nutrition', lucideIcon: BarChart2    },
  { name: 'Settings',  lucideIcon: Settings     },
];

function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bgPage, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  );
}

function MainTabs() {
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
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      {renderScreen()}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => setCurrentScreen(tab.name)}
            >
              <tab.lucideIcon
                size={26}
                color={active ? C.primary : C.textMuted}
                strokeWidth={active ? 2.2 : 1.6}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

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
  root: {
    flex: 1,
    backgroundColor: C.bgPage,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.bgSurface,
    paddingHorizontal: 6,
    paddingVertical: 10,
    ...(SHADOW.up as any),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});
