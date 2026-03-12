import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from './constants/theme';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('Recipes');
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

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
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="auto" />

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
                {active && <View style={styles.activeIndicator} />}
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
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
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bgSurface,
    height: 64,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 3,
    borderRadius: 2,
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
    color: C.primary,
    fontWeight: 'bold',
  },
});
