import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Screen = 'Recipes' | 'Planning' | 'Shopping List' | 'Nutrition';

const TABS: { name: Screen; icon: string }[] = [
  { name: 'Recipes', icon: '🍽' },
  { name: 'Planning', icon: '📅' },
  { name: 'Shopping List', icon: '🛒' },
  { name: 'Nutrition', icon: '🥗' },
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('Recipes');

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="auto" />

        {/* Contenido principal */}
        <View style={styles.content}>
          <Text style={styles.screenText}>{currentScreen}</Text>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const active = currentScreen === tab.name;
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
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenText: {
    fontSize: 24,
    color: '#aaa',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
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
    backgroundColor: '#6200ee',
  },
  tabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    color: '#888',
  },
  tabLabelActive: {
    color: '#6200ee',
    fontWeight: 'bold',
  },
});
