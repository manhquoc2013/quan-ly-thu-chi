/**
 * Post-auth hydrate: profile + settings + household (+ ledger if local empty).
 */

import { useExpenseStore, useRevenueStore } from '@/store';
import { useAuthStore } from '@/store/authStore';
import { setCacheUserId } from './cacheManager';
import { hydrateStoresFromCloud, refreshHouseholdFromCloud } from './cloudSync';
import { ensureProfileSettingsRows, fetchProfile } from './profileService';
import { applyUserSettingsToStore, fetchUserSettings } from './userSettingsService';
import { flushOutbox, pendingCount } from './syncEngine';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { initDatabase } from './database';

function isLocalLedgerEmpty(): boolean {
  return (
    useExpenseStore.getState().records.length === 0 &&
    useRevenueStore.getState().records.length === 0
  );
}

export async function bootstrapSessionAfterAuth(): Promise<{
  hasHousehold: boolean;
  storeName: string;
}> {
  if (!isSupabaseConfigured()) {
    throw new Error('Chưa cấu hình Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }

  const { data, error } = await getSupabase().auth.getUser();
  if (error) throw new Error(error.message);
  const user = data.user;
  if (!user) throw new Error('Chưa đăng nhập Supabase.');

  const email = user.email ?? null;
  await ensureProfileSettingsRows(user.id, email);

  if (pendingCount(user.id) > 0 && navigator.onLine) {
    await flushOutbox(user.id);
  }

  const [profile, settings] = await Promise.all([fetchProfile(), fetchUserSettings()]);

  if (settings) applyUserSettingsToStore(settings);

  const storeName = profile?.store_name?.trim() ?? '';
  const profileEmail = profile?.email ?? email ?? '';

  useAuthStore.setState((state) => {
    state.isAuthenticated = true;
    state.userId = user.id;
    state.supabaseEmail = email;
    state.userProfile = {
      storeName,
      email: profileEmail,
      phone: profile?.phone ?? undefined,
      address: profile?.address ?? undefined,
    };
    state.sessionToken = null;
    state.sessionExpiresAt = null;
    state.isAdmin = false;
  });

  setCacheUserId(user.id);
  try {
    await initDatabase(user.id);
  } catch (err) {
    console.warn('[bootstrap] local DB init skipped/failed', err);
  }

  const household = await refreshHouseholdFromCloud();
  if (household?.householdId && isLocalLedgerEmpty()) {
    try {
      await hydrateStoresFromCloud(household.householdId);
    } catch (err) {
      console.error('[bootstrap] ledger hydrate failed', err);
    }
  }

  return { hasHousehold: Boolean(household?.householdId), storeName };
}
