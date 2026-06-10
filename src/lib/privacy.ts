export type PrivacyLevel =
  | "public"
  | "introduction_only"
  | "circle_only"
  | "limited";

export type ProfileVisibility =
  | "self"
  | "full"
  | "limited"
  | "discover"
  | "hidden";

export const PRIVACY_OPTIONS: Array<{
  value: PrivacyLevel;
  title: string;
  short: string;
  description: string;
}> = [
  {
    value: "public",
    title: "Public Within Community",
    short: "Open",
    description:
      "Your profile is visible to all verified residents in your building.",
  },
  {
    value: "introduction_only",
    title: "Introduction Only",
    short: "By Introduction",
    description:
      "You appear in Community Match, but neighbors only see your full profile after you accept an introduction.",
  },
  {
    value: "circle_only",
    title: "Circle Members Only",
    short: "Circles Only",
    description:
      "Only residents who share at least one Circle with you can see your profile.",
  },
  {
    value: "limited",
    title: "Limited Visibility",
    short: "Minimal",
    description:
      "Only your first name, interests, and photo are visible to neighbors.",
  },
];

export function privacyOption(level: PrivacyLevel) {
  return PRIVACY_OPTIONS.find((o) => o.value === level) ?? PRIVACY_OPTIONS[0];
}
