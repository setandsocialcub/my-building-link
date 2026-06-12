import { useBranding } from "@/components/BrandingProvider";
import { brandingValue } from "@/lib/branding";

type Props = {
  eyebrow?: string;
  title: string;
  description: string;
};

/**
 * A branded intro band for main content areas. Uses the building's
 * hero image (when available) and community accent colors as a subtle
 * background, with the community name woven into the eyebrow.
 */
export function BrandedSectionIntro({ eyebrow, title, description }: Props) {
  const { branding } = useBranding();
  const community = brandingValue(branding, "community_name");
  const hero = branding?.hero_image_url ?? null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {hero ? (
        <>
          <img
            src={hero}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--primary) 75%, transparent), color-mix(in oklab, var(--background) 55%, transparent))",
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--primary) 12%, transparent), color-mix(in oklab, var(--accent) 10%, transparent))",
          }}
          aria-hidden="true"
        />
      )}
      <div className="relative px-6 py-7 sm:px-8 sm:py-8">
        <p
          className={
            "text-[11px] font-medium uppercase tracking-[0.18em] " +
            (hero ? "text-white/85" : "text-accent")
          }
        >
          {eyebrow ? `${eyebrow} · ${community}` : community}
        </p>
        <h2
          className={
            "font-serif text-2xl sm:text-3xl mt-1 " +
            (hero ? "text-white drop-shadow-sm" : "text-foreground")
          }
        >
          {title}
        </h2>
        <p
          className={
            "mt-2 max-w-2xl text-sm " +
            (hero ? "text-white/90" : "text-muted-foreground")
          }
        >
          {description}
        </p>
      </div>
    </div>
  );
}
