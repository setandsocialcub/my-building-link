/**
 * Community Concierge™ — categories, collections, and integration mappings.
 */

export const CONCIERGE_CATEGORIES = [
  { id: "Restaurants", label: "Restaurants", emoji: "🍽️" },
  { id: "Coffee", label: "Coffee Shops", emoji: "☕" },
  { id: "Fitness", label: "Fitness", emoji: "💪" },
  { id: "Wellness", label: "Wellness", emoji: "🧘" },
  { id: "Pet Services", label: "Pet Services", emoji: "🐶" },
  { id: "Beauty", label: "Beauty", emoji: "💅" },
  { id: "Shopping", label: "Shopping", emoji: "🛍️" },
  { id: "Arts & Culture", label: "Arts & Culture", emoji: "🎭" },
  { id: "Entertainment", label: "Entertainment", emoji: "🎬" },
  { id: "Outdoor", label: "Outdoor Activities", emoji: "🌳" },
  { id: "Volunteer", label: "Volunteer Opportunities", emoji: "🤝" },
  { id: "Perks", label: "Resident Perks", emoji: "🎁" },
  { id: "Community Business", label: "Community-Owned Businesses", emoji: "🏡" },
  { id: "Professional", label: "Professional Services", emoji: "💼" },
  { id: "Home Services", label: "Home Services", emoji: "🔧" },
  { id: "Guides", label: "Neighborhood Guides", emoji: "🗺️" },
  { id: "Transportation", label: "Transportation", emoji: "🚕" },
  { id: "Seasonal", label: "Seasonal Picks", emoji: "🍂" },
] as const;

export type ConciergeCategoryId = (typeof CONCIERGE_CATEGORIES)[number]["id"];

export const CONCIERGE_COLLECTIONS = [
  "Trending Nearby",
  "Resident Favorites",
  "Recently Opened",
  "Date Night",
  "Great for Families",
  "Business Lunch",
  "Outdoor Dining",
  "Brunch",
  "Cocktails",
  "Late Night",
  "Dog Friendly",
  "Work Friendly",
  "Management Picks",
  "Hidden Gems",
  "Luxury Experiences",
  "Rainy Day",
  "Holiday Guide",
] as const;

/** Maps Community Network™ professional categories → Concierge categories. */
export const NETWORK_TO_CONCIERGE: Record<string, ConciergeCategoryId> = {
  Legal: "Professional",
  Medical: "Wellness",
  Wellness: "Wellness",
  Beauty: "Beauty",
  Fitness: "Fitness",
  Creative: "Community Business",
  Technology: "Professional",
  Finance: "Professional",
  Architecture: "Professional",
  "Interior Design": "Community Business",
  Construction: "Home Services",
  Education: "Professional",
  Photography: "Community Business",
  "Food & Beverage": "Community Business",
  "Real Estate": "Professional",
  Pets: "Pet Services",
  Childcare: "Professional",
  "Home Services": "Home Services",
  Marketing: "Professional",
  Business: "Community Business",
  Entrepreneurship: "Community Business",
  Arts: "Community Business",
  Music: "Community Business",
  Consulting: "Professional",
  Coaching: "Fitness",
  Nonprofit: "Volunteer",
  Government: "Professional",
};

export function categoryMeta(id: string) {
  return CONCIERGE_CATEGORIES.find((c) => c.id === id);
}
