import { useCallback, useEffect, useState } from "react";

export type InstallPlatform =
  | "ios"
  | "android"
  | "desktop-chrome"
  | "desktop-edge"
  | "desktop-safari"
  | "desktop-firefox"
  | "desktop-other"
  | "other";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const TRACK_KEY = "oonah:install-events";

/** Fire-and-forget analytics hook. Persists a small event log and dispatches
 *  a window CustomEvent that future analytics can subscribe to. */
export function trackInstallEvent(
  name:
    | "install_button_click"
    | "install_prompt_shown"
    | "install_accepted"
    | "install_dismissed"
    | "install_completed"
    | "install_instructions_shown"
    | "install_modal_opened"
    | "install_modal_dismissed",
  detail: Record<string, unknown> = {},
) {
  const payload = { name, at: Date.now(), ...detail };
  try {
    const existing = JSON.parse(localStorage.getItem(TRACK_KEY) || "[]");
    existing.push(payload);
    localStorage.setItem(TRACK_KEY, JSON.stringify(existing.slice(-50)));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent("oonah:install", { detail: payload }));
  } catch {
    // ignore
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[oonah:install]", payload);
  }
}

function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Edg\//.test(ua)) return "desktop-edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "desktop-chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "desktop-safari";
  if (/Firefox\//.test(ua)) return "desktop-firefox";
  return "desktop-other";
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone =
    typeof navigator !== "undefined" &&
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mq || iosStandalone);
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [isInstalled, setIsInstalled] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPlatform(detectPlatform());
    setIsInstalled(detectStandalone());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      trackInstallEvent("install_prompt_shown");
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setJustInstalled(true);
      setDeferred(null);
      trackInstallEvent("install_completed");
    };
    window.addEventListener("beforeinstallprompt", onBip as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const canPrompt = deferred !== null;

  const promptInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    if (!deferred) return "unavailable";
    trackInstallEvent("install_button_click", { native: true });
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      trackInstallEvent(
        choice.outcome === "accepted" ? "install_accepted" : "install_dismissed",
      );
      setDeferred(null);
      return choice.outcome;
    } catch {
      setDeferred(null);
      return "dismissed";
    }
  }, [deferred]);

  const dismissJustInstalled = useCallback(() => setJustInstalled(false), []);

  return {
    canPrompt,
    platform,
    isInstalled,
    justInstalled,
    promptInstall,
    dismissJustInstalled,
  };
}
