/**
 * Community Voice™ — hospitality communication between residents and management.
 * Shared vocabulary, colors, and category lists used across resident and
 * manager surfaces. Language is intentionally warm ("conversation", "concern",
 * "update") — never "ticket" or "case".
 */

export type SubmissionType =
  | "concern"
  | "safety"
  | "maintenance"
  | "improvement"
  | "event_suggestion"
  | "recognition"
  | "general_feedback";

export type Priority = "general" | "low" | "medium" | "high" | "urgent";

export type Status = "received" | "viewed" | "in_progress" | "resolved" | "closed";

export const SUBMISSION_TYPES: {
  id: SubmissionType;
  label: string;
  description: string;
  emoji: string;
  requiresCategory?: boolean;
  requiresStaffName?: boolean;
}[] = [
  {
    id: "concern",
    label: "Report a Community Concern",
    description: "Something in the community that needs management's attention.",
    emoji: "💬",
    requiresCategory: true,
  },
  {
    id: "safety",
    label: "Report a Safety Issue",
    description: "A situation that could affect resident safety or wellbeing.",
    emoji: "🛡️",
    requiresCategory: true,
  },
  {
    id: "maintenance",
    label: "Report a Maintenance Observation",
    description: "Something you've noticed that may need repair or upkeep.",
    emoji: "🛠️",
    requiresCategory: true,
  },
  {
    id: "improvement",
    label: "Suggest a Community Improvement",
    description: "An idea that could make the community better for everyone.",
    emoji: "✨",
  },
  {
    id: "event_suggestion",
    label: "Suggest an Event",
    description: "An experience or gathering you'd love to see.",
    emoji: "🎉",
  },
  {
    id: "recognition",
    label: "Recognize a Staff Member",
    description: "Someone on the team who made your day better.",
    emoji: "🌟",
    requiresStaffName: true,
  },
  {
    id: "general_feedback",
    label: "Share General Feedback",
    description: "Anything else you'd like management to hear.",
    emoji: "💌",
  },
];

export const CATEGORIES = [
  "Pool",
  "Gym",
  "Elevator",
  "Parking",
  "Lobby",
  "Rooftop",
  "Package Room",
  "Security",
  "Noise",
  "Cleanliness",
  "Pets",
  "Lighting",
  "Landscaping",
  "Concierge",
  "Staff",
  "Amenity",
  "Technology",
  "General Community",
  "Other",
] as const;

export const PRIORITIES: { id: Priority; label: string; description: string; tone: string }[] = [
  { id: "general", label: "General Feedback", description: "No urgency — just sharing.", tone: "bg-muted text-foreground" },
  { id: "low", label: "Low Priority", description: "Whenever you get to it.", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { id: "medium", label: "Medium Priority", description: "Please look into this soon.", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { id: "high", label: "High Priority", description: "Needs attention within the day.", tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  { id: "urgent", label: "Urgent Safety Concern", description: "Immediate management attention required.", tone: "bg-red-500/15 text-red-700 dark:text-red-300" },
];

export const STATUS_META: Record<Status, { label: string; emoji: string; tone: string }> = {
  received: { label: "Received", emoji: "✅", tone: "bg-muted text-foreground" },
  viewed: { label: "Viewed by management", emoji: "👀", tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  in_progress: { label: "In progress", emoji: "🔄", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  resolved: { label: "Resolved", emoji: "✅", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  closed: { label: "Closed", emoji: "🗂️", tone: "bg-muted text-muted-foreground" },
};

export function submissionTypeMeta(id: SubmissionType) {
  return SUBMISSION_TYPES.find((s) => s.id === id) ?? SUBMISSION_TYPES[SUBMISSION_TYPES.length - 1];
}
