/**
 * Household tenancy — create / invite / redeem via Supabase RPCs.
 */

import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export interface HouseholdInfo {
  householdId: string;
  householdName: string;
  role: 'owner' | 'member';
}

export async function signUpSupabase(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(error.message);
}

export async function signInSupabase(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(error.message);
}

export async function signOutSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabase().auth.signOut();
}

export async function getSupabaseSessionEmail(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.email ?? null;
}

export async function getMyHousehold(): Promise<HouseholdInfo | null> {
  const { data, error } = await getSupabase().rpc('get_my_household');
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.household_id) return null;
  return {
    householdId: row.household_id as string,
    householdName: row.household_name as string,
    role: row.role as 'owner' | 'member',
  };
}

export async function createHousehold(name: string): Promise<HouseholdInfo> {
  const { data, error } = await getSupabase().rpc('create_household', { p_name: name });
  if (error) throw new Error(error.message);
  const row = data as { id: string; name: string };
  return { householdId: row.id, householdName: row.name, role: 'owner' };
}

export async function createInvite(expiresHours = 72): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_invite', {
    p_expires_hours: expiresHours,
  });
  if (error) throw new Error(error.message);
  return (data as { code: string }).code;
}

export async function redeemInvite(code: string): Promise<HouseholdInfo> {
  const { data, error } = await getSupabase().rpc('redeem_invite', { p_code: code });
  if (error) throw new Error(error.message);
  const row = data as { id: string; name: string };
  return { householdId: row.id, householdName: row.name, role: 'member' };
}
