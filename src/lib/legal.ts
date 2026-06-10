import { supabase } from "@/integrations/supabase/client";

export type LegalSlug = "privacy" | "terms" | "community-standards";

export type LegalDocument = {
  id: string;
  slug: LegalSlug;
  version: number;
  title: string;
  content: string;
  updated_at: string;
};

export const LEGAL_META: Record<LegalSlug, { title: string; route: "/privacy" | "/terms" | "/community-standards" }> = {
  privacy: { title: "Privacy Policy", route: "/privacy" },
  terms: { title: "Terms of Use", route: "/terms" },
  "community-standards": { title: "Community Standards", route: "/community-standards" },
};

export async function fetchLegalDocument(slug: LegalSlug): Promise<LegalDocument | null> {
  const { data, error } = await (supabase as any)
    .from("legal_documents")
    .select("id, slug, version, title, content, updated_at")
    .eq("slug", slug)
    .eq("is_current", true)
    .maybeSingle();
  if (error) {
    console.error("[legal] fetch failed", error);
    return null;
  }
  return (data as LegalDocument) ?? null;
}

/**
 * Lightweight markdown renderer for legal copy. Supports:
 *  # h1, ## h2, ### h3, - bullets, **bold**, blank-line paragraphs.
 */
export function renderMarkdownToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      closeList();
      html += `<h3 class="font-serif text-lg mt-6 mb-2">${inline(line.replace(/^###\s+/, ""))}</h3>`;
    } else if (/^##\s+/.test(line)) {
      closeList();
      html += `<h2 class="font-serif text-xl mt-8 mb-3">${inline(line.replace(/^##\s+/, ""))}</h2>`;
    } else if (/^#\s+/.test(line)) {
      closeList();
      html += `<h1 class="font-serif text-3xl mt-2 mb-4">${inline(line.replace(/^#\s+/, ""))}</h1>`;
    } else if (/^-\s+/.test(line)) {
      if (!inList) {
        html += '<ul class="list-disc pl-6 space-y-1 my-3">';
        inList = true;
      }
      html += `<li>${inline(line.replace(/^-\s+/, ""))}</li>`;
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      html += `<p class="my-3 leading-relaxed">${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}
