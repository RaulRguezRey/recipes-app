import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

const TABS: { name: Tab; icon: string }[] = [
  { name: 'Recipes', icon: '🍽' },
  { name: 'Planning', icon: '📅' },
  { name: 'Shopping List', icon: '🛒' },
  { name: 'Nutrition', icon: '🥗' },
  { name: 'Settings', icon: '⚙️' },
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
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.name}
              </Text>
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
    height: 72,
    paddingHorizontal: 6,
    paddingVertical: 8,
    ...(SHADOW.up as any),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    paddingVertical: 6,
  },
  tabActive: {
    backgroundColor: C.primary,
  },
  tabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    color: C.textMuted,
  },
  tabLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
