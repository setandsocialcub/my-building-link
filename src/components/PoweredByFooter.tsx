import { useBranding } from "@/components/BrandingProvider";

/**
 * Subtle "Powered by Residence" badge. Hidden if the manager has disabled
 * `enable_powered_by_footer` in branding settings.
 */
export function PoweredByFooter({ className }: { className?: string }) {
  const { branding } = useBranding();
  // Default true (NOT NULL default in DB); hide only when explicitly false
  const enabled = branding?.enable_powered_by_footer !== false;
  if (!enabled) return null;
  return (
    <footer
      className={
        "py-6 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 " +
        (className ?? "")
      }
    >
      Powered by Residence
    </footer>
  );
}
