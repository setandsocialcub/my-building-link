import { Shield, Users, Sparkles, EyeOff, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIVACY_OPTIONS, type PrivacyLevel } from "@/lib/privacy";

const ICONS: Record<PrivacyLevel, React.ComponentType<{ className?: string }>> = {
  public: Users,
  introduction_only: Sparkles,
  circle_only: Shield,
  limited: EyeOff,
};

export function PrivacyLevelPicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: PrivacyLevel;
  onChange: (v: PrivacyLevel) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-2", compact ? "" : "sm:grid-cols-2")}>
      {PRIVACY_OPTIONS.map((opt) => {
        const Icon = ICONS[opt.value];
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "group flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
              selected
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              {selected ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {opt.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {opt.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PrivacyBadge({ level }: { level: PrivacyLevel }) {
  const opt = PRIVACY_OPTIONS.find((o) => o.value === level) ?? PRIVACY_OPTIONS[0];
  const Icon = ICONS[opt.value];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground">
      <Icon className="h-3 w-3 text-primary" />
      {opt.short}
    </span>
  );
}
