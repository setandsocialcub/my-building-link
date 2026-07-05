import { supabase } from "@/integrations/supabase/client";

export type BuildingLegalType =
  | "privacy"
  | "terms"
  | "pool-rules"
  | "pet-policy"
  | "parking-rules"
  | "community-rules"
  | "emergency-procedures"
  | "move-in-guide"
  | "house-rules";

export type BuildingLegalDoc = {
  id: string;
  building_id: string;
  doc_type: BuildingLegalType;
  title: string;
  content: string;
  version: number;
  is_current: boolean;
  updated_at: string;
};

export const BUILDING_LEGAL_META: Record<
  BuildingLegalType,
  { title: string; description: string; icon: string; required?: boolean }
> = {
  privacy: {
    title: "Privacy Policy",
    description: "How resident data is collected, used, and protected.",
    icon: "🔒",
    required: true,
  },
  terms: {
    title: "Terms of Use",
    description: "Rules of engagement for using the resident platform.",
    icon: "📜",
    required: true,
  },
  "house-rules": {
    title: "House Rules",
    description: "Everyday conduct expectations for all residents.",
    icon: "🏠",
  },
  "community-rules": {
    title: "Community Rules",
    description: "Shared standards that keep the community welcoming.",
    icon: "🤝",
  },
  "pool-rules": {
    title: "Pool Rules",
    description: "Hours, guest policy, and safety guidelines for the pool.",
    icon: "🏊",
  },
  "pet-policy": {
    title: "Pet Policy",
    description: "Registration, leash rules, and pet-friendly zones.",
    icon: "🐾",
  },
  "parking-rules": {
    title: "Parking Rules",
    description: "Assigned spaces, guest parking, and towing policy.",
    icon: "🚗",
  },
  "emergency-procedures": {
    title: "Emergency Procedures",
    description: "Fire, medical, and evacuation instructions.",
    icon: "🚨",
  },
  "move-in-guide": {
    title: "Move-In Guide",
    description: "Everything a new resident needs on day one.",
    icon: "📦",
  },
};

export const BUILDING_LEGAL_ORDER: BuildingLegalType[] = [
  "privacy",
  "terms",
  "house-rules",
  "community-rules",
  "pool-rules",
  "pet-policy",
  "parking-rules",
  "emergency-procedures",
  "move-in-guide",
];

export async function fetchBuildingLegalDocs(buildingId: string): Promise<BuildingLegalDoc[]> {
  const { data, error } = await (supabase as any)
    .from("building_legal_documents")
    .select("id, building_id, doc_type, title, content, version, is_current, updated_at")
    .eq("building_id", buildingId)
    .eq("is_current", true);
  if (error) {
    console.error("[building-legal] fetch failed", error);
    return [];
  }
  return (data as BuildingLegalDoc[]) ?? [];
}

export async function fetchBuildingLegalDoc(
  buildingId: string,
  docType: BuildingLegalType,
): Promise<BuildingLegalDoc | null> {
  const { data } = await (supabase as any)
    .from("building_legal_documents")
    .select("id, building_id, doc_type, title, content, version, is_current, updated_at")
    .eq("building_id", buildingId)
    .eq("doc_type", docType)
    .eq("is_current", true)
    .maybeSingle();
  return (data as BuildingLegalDoc) ?? null;
}

export async function publishBuildingLegalDoc(input: {
  buildingId: string;
  docType: BuildingLegalType;
  title: string;
  content: string;
  currentVersion: number;
  userId: string | null;
}): Promise<BuildingLegalDoc> {
  const nextVersion = input.currentVersion + 1;
  await (supabase as any)
    .from("building_legal_documents")
    .update({ is_current: false })
    .eq("building_id", input.buildingId)
    .eq("doc_type", input.docType)
    .eq("is_current", true);

  const { data, error } = await (supabase as any)
    .from("building_legal_documents")
    .insert({
      building_id: input.buildingId,
      doc_type: input.docType,
      title: input.title.trim(),
      content: input.content,
      version: nextVersion,
      is_current: true,
      updated_by: input.userId,
    })
    .select("id, building_id, doc_type, title, content, version, is_current, updated_at")
    .single();
  if (error || !data) throw error ?? new Error("Could not publish");
  return data as BuildingLegalDoc;
}
