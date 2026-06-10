import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBranding } from "@/components/BrandingProvider";
import { brandingValue } from "@/lib/branding";

const DISMISS_KEY = "residence:install-prompt-dismissed-at";
const DISMISS_DAYS = 7;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari uses navigator.standalone
  const iosStandalone =
    typeof navigator !== "undefined" &&
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mq || iosStandalone);
}

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const { branding } = useBranding();
  const communityName = brandingValue(branding, "community_name");
  const appIcon = branding?.app_icon_url || branding?.logo_url || null;
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || wasRecentlyDismissed() || !isMobile()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);

    // iOS Safari doesn't fire beforeinstallprompt — show a manual hint after a short delay.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      timer = setTimeout(() => {
        setIosHint(true);
        setVisible(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 md:left-auto md:right-4 md:bottom-4 md:max-w-sm"
      role="dialog"
      aria-label={`Install ${communityName} app`}
    >
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary grid place-items-center overflow-hidden">
            {appIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={appIcon} alt="" className="h-full w-full object-cover" />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Install {communityName}</p>
            {iosHint ? (
              <p className="mt-1 text-xs text-muted-foreground leading-snug">
                Tap <Share className="inline h-3.5 w-3.5 align-text-bottom" /> in Safari, then
                choose <span className="font-medium">Add to Home Screen</span>.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground leading-snug">
                Add {communityName} to your home screen for a faster, app-like experience.
              </p>
            )}
            {!iosHint && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={install} className="h-8">
                  Install
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss} className="h-8">
                  Not now
                </Button>
              </div>
            )}
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
  );
}
