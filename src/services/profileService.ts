/**
 * Cloud profile row — maps to public.profiles.
 */

import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export interface ProfileRow {
  user_id: string;
  store_name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  updated_at: string;
}

export async function fetchProfile(): Promise<ProfileRow | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase().from('profiles').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProfileRow | null) ?? null;
}

export async function upsertProfile(patch: Partial<ProfileRow> & { user_id: string }): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .upsert(
      {
        user_id: patch.user_id,
        store_name: patch.store_name ?? '',
        phone: patch.phone ?? null,
        address: patch.address ?? null,
        email: patch.email ?? null,
      },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(error.message);
}

export async function ensureProfileSettingsRows(userId: string, email: string | null): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = getSupabase();
  const { error: profileErr } = await client.from('profiles').upsert(
    { user_id: userId, email: email ?? null, store_name: '' },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
  if (profileErr) throw new Error(profileErr.message);
  const { error: settingsErr } = await client
    .from('user_settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (settingsErr) throw new Error(settingsErr.message);
}
