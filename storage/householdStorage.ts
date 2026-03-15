import { supabase } from '../lib/supabase';
import { Household, Profile } from '../context/AuthContext';

export type HouseholdMember = Profile & { joined_at: string };

/** Returns the household the user belongs to, or null. */
export async function getUserHousehold(userId: string): Promise<Household | null> {
  const { data } = await supabase
    .from('household_members')
    .select('households(id, name, code, created_by)')
    .eq('user_id', userId)
    .limit(1)
    .single();
  return (data as any)?.households ?? null;
}

/** Returns all members of a household with their profiles. */
export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('joined_at, profiles(id, display_name)')
    .eq('household_id', householdId);

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.profiles.id,
    display_name: row.profiles.display_name,
    joined_at: row.joined_at,
  }));
}
