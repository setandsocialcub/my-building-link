import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InstallOonahModal } from "@/components/InstallOonahModal";
import { usePwaInstall, trackInstallEvent } from "@/hooks/use-pwa-install";

const DISMISS_KEY = "oonah:install-prompt-dismissed-at";
const DISMISS_DAYS = 7;

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

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

export function InstallPrompt() {
  const { isInstalled, canPrompt, platform } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInstalled || wasRecentlyDismissed() || !isMobile()) return;

    // Show once the browser signals installability, or after a short delay on iOS
    // (which never fires beforeinstallprompt).
    if (canPrompt) {
      setVisible(true);
      return;
    }
    if (platform === "ios") {
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }
  }, [canPrompt, isInstalled, platform]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (isInstalled || !visible) return null;

  return (
    <>
      <div
        className="fixed inset-x-3 bottom-3 z-50 md:left-auto md:right-4 md:bottom-4 md:max-w-sm animate-fade-in"
        role="dialog"
        aria-label="Install OONAH app"
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-lg">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/15 text-primary grid place-items-center ring-1 ring-primary/20">
              <Download className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Install OONAH</p>
              <p className="mt-1 text-xs text-muted-foreground leading-snug">
                Add OONAH to your home screen for a faster, app-like experience.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    trackInstallEvent("install_button_click", { source: "mobile_toast" });
                    setModalOpen(true);
                  }}
                  className="h-8 rounded-lg gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss} className="h-8 rounded-lg">
                  Not now
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="text-muted-foreground hover:text-foreground rounded-md p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <InstallOonahModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
