/**
 * Community Network™ constants — categories, goals, expert badges, and
 * profession synonyms for smarter search.
 */

export const NETWORK_CATEGORIES = [
  "Legal",
  "Medical",
  "Wellness",
  "Beauty",
  "Fitness",
  "Creative",
  "Technology",
  "Finance",
  "Architecture",
  "Interior Design",
  "Construction",
  "Education",
  "Photography",
  "Food & Beverage",
  "Real Estate",
  "Pets",
  "Childcare",
  "Home Services",
  "Marketing",
  "Business",
  "Entrepreneurship",
  "Arts",
  "Music",
  "Consulting",
  "Coaching",
  "Nonprofit",
  "Government",
  "Other",
] as const;

export type NetworkCategory = (typeof NETWORK_CATEGORIES)[number];

export const COMMUNITY_GOALS = [
  "Looking for Friends",
  "Looking for Networking",
  "Looking for Business Connections",
  "Looking for Running Partners",
  "Looking for Pickleball",
  "Looking for Dog Walking Partners",
  "Looking for Parents",
  "Open to Mentoring",
  "Open to Being Mentored",
  "Open to Coffee",
  "Open to Collaborations",
] as const;

export const EXPERT_BADGES: Array<{ id: string; label: string; emoji: string }> = [
  { id: "local_guide", label: "Local Guide", emoji: "🏡" },
  { id: "food_enthusiast", label: "Food Enthusiast", emoji: "🍷" },
  { id: "wellness_advocate", label: "Wellness Advocate", emoji: "🧘" },
  { id: "pet_expert", label: "Pet Expert", emoji: "🐶" },
  { id: "legal_pro", label: "Legal Professional", emoji: "👩‍⚖️" },
  { id: "real_estate", label: "Real Estate Expert", emoji: "🏠" },
  { id: "business_mentor", label: "Business Mentor", emoji: "💼" },
  { id: "creative", label: "Creative", emoji: "🎨" },
  { id: "chef", label: "Chef", emoji: "👨‍🍳" },
  { id: "sustainability", label: "Sustainability Champion", emoji: "🌱" },
];

export function badgeById(id: string) {
  return EXPERT_BADGES.find((b) => b.id === id);
}

/** Profession synonyms: querying any key term returns the same bucket. */
const SYNONYM_GROUPS: string[][] = [
  ["attorney", "lawyer", "counsel", "legal"],
  ["cpa", "accountant", "accounting", "bookkeeper"],
  ["md", "doctor", "physician"],
  ["dentist", "dental"],
  ["therapist", "psychologist", "counselor", "counsellor"],
  ["chef", "cook", "culinary"],
  ["designer", "design"],
  ["interior designer", "interiors", "decorator"],
  ["realtor", "real estate", "broker"],
  ["dev", "developer", "engineer", "programmer", "software"],
  ["photographer", "photo", "photography"],
  ["tutor", "teacher", "instructor", "educator"],
  ["trainer", "coach", "personal trainer"],
  ["financial advisor", "advisor", "wealth"],
  ["plumber", "plumbing"],
  ["electrician", "electric"],
  ["builder", "contractor", "construction"],
  ["marketing", "brand", "growth"],
  ["yoga", "pilates"],
  ["dog walker", "pet sitter", "dog walking"],
];

export function expandSynonyms(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = new Set<string>([q]);
  for (const group of SYNONYM_GROUPS) {
    if (group.some((w) => w.includes(q) || q.includes(w))) {
      group.forEach((w) => out.add(w));
    }
  }
  return [...out];
}

export type NetworkAudience =
  | "everyone"
  | "building"
  | "circles"
  | "searchable_only"
  | "hidden";

export const NETWORK_AUDIENCE_OPTIONS: Array<{
  value: NetworkAudience;
  label: string;
  description: string;
}> = [
  { value: "everyone", label: "Visible to Everyone", description: "Anyone in your community." },
  { value: "building", label: "My Building Only", description: "Only verified residents in your building." },
  { value: "circles", label: "My Circles Only", description: "Only neighbors who share a Circle with you." },
  { value: "searchable_only", label: "Only When Searched", description: "You won't appear in browse, but you can be found by search." },
  { value: "hidden", label: "Hidden", description: "You won't appear anywhere in Community Network." },
];
