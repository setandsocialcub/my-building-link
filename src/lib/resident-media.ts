import { supabase } from "@/integrations/supabase/client";

export const RESIDENT_MEDIA_BUCKET = "resident-media";

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Returns a signed URL for a stored resident-media path. Cached in-memory for
 * ~50 minutes to avoid re-signing on every render.
 */
export async function signResidentMedia(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const cached = signedUrlCache.get(path);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) return cached.url;

  const { data, error } = await supabase.storage
    .from(RESIDENT_MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: now + 55 * 60 * 1000 });
  return data.signedUrl;
}

export async function uploadResidentMedia(
  userId: string,
  kind: "avatar" | "cover",
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${kind}-${Date.now()}.${ext || "jpg"}`;
  const { error } = await supabase.storage
    .from(RESIDENT_MEDIA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function deleteResidentMedia(path: string | null | undefined) {
  if (!path) return;
  await supabase.storage.from(RESIDENT_MEDIA_BUCKET).remove([path]);
  signedUrlCache.delete(path);
}
