// Shared Circle category + type metadata used across the app.

export type CircleCategoryKey =
  | "wellness"
  | "fitness"
  | "entrepreneurs"
  | "dog_parents"
  | "lgbtq"
  | "foodies"
  | "book_club"
  | "new_residents"
  | "volunteer"
  | "custom";

export type CircleCategoryMeta = {
  key: CircleCategoryKey;
  label: string;
  emoji: string;
  /** Lowercase interest tags that recommend this circle for a resident. */
  interestMatches: string[];
};

export const CIRCLE_CATEGORIES: CircleCategoryMeta[] = [
  { key: "wellness", label: "Wellness", emoji: "🧘", interestMatches: ["yoga", "meditation", "pilates", "wellness"] },
  { key: "fitness", label: "Fitness", emoji: "💪", interestMatches: ["running", "cycling", "strength training", "swimming", "tennis", "hiking", "fitness"] },
  { key: "entrepreneurs", label: "Entrepreneurs", emoji: "🚀", interestMatches: ["entrepreneurship", "tech & startups", "finance & investing", "startups"] },
  { key: "dog_parents", label: "Dog Parents", emoji: "🐶", interestMatches: ["pets & dogs", "dogs", "pets"] },
  { key: "lgbtq", label: "LGBTQ+", emoji: "🏳️‍🌈", interestMatches: ["lgbtq", "lgbtq+", "pride"] },
  { key: "foodies", label: "Foodies", emoji: "🍽️", interestMatches: ["cooking", "wine", "cocktails", "restaurant hunting", "baking", "coffee", "vegan & plant-based", "food"] },
  { key: "book_club", label: "Book Club", emoji: "📚", interestMatches: ["reading & books", "writing", "books"] },
  { key: "new_residents", label: "New Residents", emoji: "👋", interestMatches: ["new to the building", "new to the city"] },
  { key: "volunteer", label: "Volunteer", emoji: "🤝", interestMatches: ["sustainability", "volunteer", "community service"] },
  { key: "custom", label: "Custom", emoji: "✨", interestMatches: [] },
];

export const CATEGORY_BY_KEY: Record<string, CircleCategoryMeta> = Object.fromEntries(
  CIRCLE_CATEGORIES.map((c) => [c.key, c]),
);

export function categoryLabel(key: string | null | undefined): string {
  if (!key) return "Circle";
  return CATEGORY_BY_KEY[key]?.label ?? toTitle(key);
}

export function categoryEmojiFallback(key: string | null | undefined): string {
  if (!key) return "👥";
  return CATEGORY_BY_KEY[key]?.emoji ?? "👥";
}

function toTitle(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type CircleType = "resident_created" | "building_sponsored";

export const CIRCLE_TYPE_META: Record<CircleType, { label: string; tone: string }> = {
  resident_created: { label: "Resident-Created", tone: "bg-secondary text-secondary-foreground" },
  building_sponsored: { label: "Building Sponsored", tone: "bg-primary/10 text-primary" },
};

/**
 * Score a circle for a resident based on overlap between resident interests
 * and the circle's category + tags. Higher = better match.
 */
export function scoreCircleForResident(
  circle: { category: string | null; interest_tag: string | null; name: string },
  interests: string[],
): number {
  const tagsLower = interests.map((t) => t.toLowerCase());
  if (tagsLower.length === 0) return 0;
  const meta = circle.category ? CATEGORY_BY_KEY[circle.category] : undefined;
  let score = 0;
  if (meta) {
    for (const m of meta.interestMatches) {
      if (tagsLower.some((t) => t.includes(m) || m.includes(t))) score += 2;
    }
  }
  const tag = (circle.interest_tag ?? "").toLowerCase();
  const name = circle.name.toLowerCase();
  for (const t of tagsLower) {
    if (!t) continue;
    if (tag && (tag.includes(t) || t.includes(tag))) score += 2;
    if (name.includes(t)) score += 1;
  }
  return score;
}
