/**
 * Industry Mode — adapts platform terminology per vertical.
 *
 * OONAH powers many hospitality verticals. Each has its own vocabulary
 * for "the person", "the place", and "the operator". Change these labels
 * here and every surface that uses `useIndustryTerms()` follows.
 */

export type IndustryType =
  | "luxury_residential"
  | "multifamily"
  | "boutique_hotel"
  | "branded_residence"
  | "student_housing"
  | "senior_living"
  | "corporate_housing"
  | "private_club"
  | "mixed_use";

export type IndustryTerminology = {
  /** Person singular ("Resident", "Guest", "Member", "Student") */
  member: string;
  /** Person plural */
  members: string;
  /** Place singular ("Community", "Property", "Residence", "Club") */
  community: string;
  /** Operator label ("Property Manager", "General Manager", "Concierge") */
  manager: string;
  /** Welcome verb prefix ("Welcome home", "Welcome back", "Welcome") */
  welcome: string;
  /** Dashboard label */
  dashboard: string;
};

export const INDUSTRY_META: Record<
  IndustryType,
  { label: string; description: string; terminology: IndustryTerminology }
> = {
  luxury_residential: {
    label: "Luxury Residential",
    description: "High-end condominiums and residential towers.",
    terminology: {
      member: "Resident",
      members: "Residents",
      community: "Community",
      manager: "Property Manager",
      welcome: "Welcome home",
      dashboard: "Resident Dashboard",
    },
  },
  multifamily: {
    label: "Multifamily",
    description: "Rental communities and apartment portfolios.",
    terminology: {
      member: "Resident",
      members: "Residents",
      community: "Community",
      manager: "Community Manager",
      welcome: "Welcome home",
      dashboard: "Resident Dashboard",
    },
  },
  boutique_hotel: {
    label: "Boutique Hotel",
    description: "Boutique hospitality and extended-stay properties.",
    terminology: {
      member: "Guest",
      members: "Guests",
      community: "Property",
      manager: "General Manager",
      welcome: "Welcome",
      dashboard: "Guest Dashboard",
    },
  },
  branded_residence: {
    label: "Branded Residence",
    description: "Hotel-branded ownership residences.",
    terminology: {
      member: "Owner",
      members: "Owners",
      community: "Residence",
      manager: "Residence Manager",
      welcome: "Welcome home",
      dashboard: "Owner Dashboard",
    },
  },
  student_housing: {
    label: "Student Housing",
    description: "Purpose-built student housing and university residence.",
    terminology: {
      member: "Student",
      members: "Students",
      community: "Residence",
      manager: "Residence Life",
      welcome: "Welcome back",
      dashboard: "Student Dashboard",
    },
  },
  senior_living: {
    label: "Senior Living",
    description: "Senior living, independent, and assisted communities.",
    terminology: {
      member: "Resident",
      members: "Residents",
      community: "Community",
      manager: "Community Director",
      welcome: "Welcome home",
      dashboard: "Community Dashboard",
    },
  },
  corporate_housing: {
    label: "Corporate Housing",
    description: "Corporate housing and executive apartments.",
    terminology: {
      member: "Employee",
      members: "Employees",
      community: "Property",
      manager: "Property Manager",
      welcome: "Welcome",
      dashboard: "Employee Dashboard",
    },
  },
  private_club: {
    label: "Private Club",
    description: "Members-only clubs and social venues.",
    terminology: {
      member: "Member",
      members: "Members",
      community: "Club",
      manager: "Club Manager",
      welcome: "Welcome back",
      dashboard: "Member Dashboard",
    },
  },
  mixed_use: {
    label: "Mixed-Use",
    description: "Mixed-use developments combining residential, retail, and hospitality.",
    terminology: {
      member: "Resident",
      members: "Residents",
      community: "Community",
      manager: "Property Manager",
      welcome: "Welcome home",
      dashboard: "Community Dashboard",
    },
  },
};

export const INDUSTRY_TYPES = Object.keys(INDUSTRY_META) as IndustryType[];

export function isIndustryType(v: unknown): v is IndustryType {
  return typeof v === "string" && v in INDUSTRY_META;
}

export function terminologyFor(industry: IndustryType | null | undefined): IndustryTerminology {
  const key = isIndustryType(industry) ? industry : "luxury_residential";
  return INDUSTRY_META[key].terminology;
}

export const COMMUNITY_VOICES = [
  { id: "luxury", label: "Luxury", description: "Understated, refined, aspirational." },
  { id: "professional", label: "Professional", description: "Clear, direct, businesslike." },
  { id: "warm", label: "Warm", description: "Friendly, personable, human." },
  { id: "boutique", label: "Boutique", description: "Curated, editorial, tasteful." },
  { id: "playful", label: "Playful", description: "Lively, informal, upbeat." },
  { id: "corporate", label: "Corporate", description: "Formal, brand-safe, on-message." },
  { id: "family", label: "Family", description: "Approachable, community-first." },
  { id: "hospitality", label: "Hospitality", description: "Attentive, gracious, service-led." },
] as const;

export type CommunityVoice = (typeof COMMUNITY_VOICES)[number]["id"];
