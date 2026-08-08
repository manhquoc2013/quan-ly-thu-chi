/**
 * Product image upload to Supabase Storage bucket `product-images`.
 */

import { compressImage } from '@/utils/image';
import { getActiveHouseholdId } from './cloudSync';
import { getSupabase } from './supabaseClient';

const BUCKET = 'product-images';

export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const householdId = getActiveHouseholdId();
  if (!householdId) throw new Error('Chưa kết nối sổ chung');

  const blob = await compressImage(file, 1200, 0.82);
  const path = `${householdId}/${productId}/${Date.now()}.jpg`;

  const { error } = await getSupabase().storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function getProductImageUrl(imagePath: string): Promise<string | null> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(imagePath, 3600);
  if (error) {
    console.error('[productImage]', error);
    return null;
  }
  return data.signedUrl;
}

export async function removeProductImage(imagePath: string): Promise<void> {
  const { error } = await getSupabase().storage.from(BUCKET).remove([imagePath]);
  if (error) throw new Error(error.message);
}
