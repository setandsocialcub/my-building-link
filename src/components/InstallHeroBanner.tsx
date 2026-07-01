import { useEffect, useState } from "react";
import { Sparkles, X, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InstallOonahModal } from "@/components/InstallOonahModal";
import { usePwaInstall, trackInstallEvent } from "@/hooks/use-pwa-install";

const DISMISS_KEY = "oonah:install-banner-dismissed-at";
const DISMISS_DAYS = 7;

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallHeroBanner() {
  const { isInstalled } = usePwaInstall();
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(wasRecentlyDismissed());
  }, []);

  if (!mounted || isInstalled || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    trackInstallEvent("install_modal_dismissed", { source: "hero_banner" });
    setDismissed(true);
  };

  const openLearnMore = () => {
    trackInstallEvent("install_button_click", { source: "hero_learn_more" });
    setModalOpen(true);
  };

  const openInstall = () => {
    trackInstallEvent("install_button_click", { source: "hero_primary" });
    setModalOpen(true);
  };

  return (
    <>
      <section
        aria-label="Install OONAH"
        className="relative mx-auto w-full max-w-3xl animate-fade-in"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-card/60 to-accent/10 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.4)]">
          {/* Decorative glows */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full bg-primary/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl"
          />

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install banner"
            className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
            <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/15 text-primary grid place-items-center ring-1 ring-primary/25">
              <Sparkles className="h-6 w-6" />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                Take OONAH With You
              </h2>
              <p className="mt-1.5 text-sm sm:text-[15px] text-muted-foreground leading-relaxed">
                Install OONAH for a faster, app-like experience and stay connected to your
                community wherever you are.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={openInstall}
                  className="h-10 px-4 rounded-xl gap-2 shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  Install OONAH
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={openLearnMore}
                  className="h-10 px-4 rounded-xl"
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <InstallOonahModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
