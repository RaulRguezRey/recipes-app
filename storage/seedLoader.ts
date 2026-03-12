import AsyncStorage from '@react-native-async-storage/async-storage';
import seedData from '../seeds/data.json';

const SEED_FLAG = '@seeded_v1';

/**
 * On first launch, loads the seed data (recipes + ingredients) into AsyncStorage.
 * Subsequent launches are no-ops.
 */
export async function loadSeedIfNeeded(): Promise<void> {
  const already = await AsyncStorage.getItem(SEED_FLAG);
  if (already) return;

  // Only seed if AsyncStorage is empty (don't overwrite user data)
  const existingRecipes = await AsyncStorage.getItem('@recipes');
  if (!existingRecipes || JSON.parse(existingRecipes).length === 0) {
    await AsyncStorage.setItem('@recipes', JSON.stringify(seedData.recipes));
  }

  const existingIngredients = await AsyncStorage.getItem('@ingredients');
  if (!existingIngredients || JSON.parse(existingIngredients).length === 0) {
    await AsyncStorage.setItem('@ingredients', JSON.stringify(seedData.ingredients));
  }

  await AsyncStorage.setItem(SEED_FLAG, '1');
}
