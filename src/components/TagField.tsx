import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Chip-style tag editor for text[] profile fields.
 */
export function TagField({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  suggestions,
  max = 20,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (value.length >= max) return;
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
    setDraft("");
  };

  const remove = (i: number) => {
    const next = value.slice();
    next.splice(i, 1);
    onChange(next);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value.length - 1);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground -mt-0.5">{hint}</p>}
      <div className="rounded-md border border-input bg-background px-2 py-1.5 flex flex-wrap gap-1.5">
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(i)}
              className="hover:text-primary/70"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => commit(draft)}
          placeholder={value.length ? "" : placeholder}
          className="h-7 flex-1 min-w-[120px] border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0"
        />
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {suggestions
            .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
            .slice(0, 8)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => commit(s)}
                className="text-[11px] rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
