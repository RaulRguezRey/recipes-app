import { supabase } from '../lib/supabase';

/**
 * Seed copying for new users is now handled automatically server-side by the
 * `handle_new_user` Postgres trigger (runs when a new auth.users row is inserted).
 *
 * This function is kept as a no-op so that any remaining call sites don't break.
 */
export async function loadSeedIfNeeded(): Promise<void> {
  // No-op — seed data is copied by the DB trigger on user registration.
}

/**
 * Re-copies all seed (template) recipes for the given user.
 * Existing user-owned copies are kept (on conflict do nothing), so this is safe
 * to call multiple times — it only fills in recipes the user is missing.
 *
 * Called from the "Reload seed data" button in SettingsScreen.
 */
export async function resetAndReloadSeed(userId: string): Promise<void> {
  const { error } = await supabase.rpc('copy_seeds_for_user', { p_user_id: userId });
  if (error) throw error;
}
