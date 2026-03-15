import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { C, RADIUS, SHADOW } from './constants/theme';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/auth/LoginScreen';
import RecipesScreen from './screens/RecipesScreen';
import PlanningScreen from './screens/PlanningScreen';
import ShoppingListScreen from './screens/ShoppingListScreen';
import NutritionScreen from './screens/NutritionScreen';
import IngredientsScreen from './screens/IngredientsScreen';
import SettingsScreen from './screens/SettingsScreen';

type Tab = 'Recipes' | 'Planning' | 'Shopping List' | 'Nutrition' | 'Settings';
type Screen = Tab | 'Ingredients';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: Tab; icon: IoniconName; iconActive: IoniconName }[] = [
  { name: 'Recipes',       icon: 'restaurant-outline', iconActive: 'restaurant' },
  { name: 'Planning',      icon: 'calendar-outline',   iconActive: 'calendar' },
  { name: 'Shopping List', icon: 'cart-outline',        iconActive: 'cart' },
  { name: 'Nutrition',     icon: 'nutrition-outline',  iconActive: 'nutrition' },
  { name: 'Settings',      icon: 'settings-outline',   iconActive: 'settings' },
];

function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bgPage, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  );
}

function MainTabs() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('Recipes');
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  function handleGenerateList(planId: string) {
    setActivePlanId(planId);
    setCurrentScreen('Shopping List');
  }

  function renderScreen() {
    switch (currentScreen) {
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

  const activeTab: Tab = currentScreen === 'Ingredients' ? 'Settings' : (currentScreen as Tab);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="auto" />

      {renderScreen()}

      {/* Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom || 8 }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setCurrentScreen(tab.name)}
            >
              <Ionicons
                name={active ? tab.iconActive : tab.icon}
                size={24}
                color={active ? '#fff' : C.textMuted}
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
    height: 62,
    paddingHorizontal: 6,
    paddingVertical: 6,
    ...(SHADOW.up as any),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  tabActive: {
    backgroundColor: C.primary,
  },
});
