/**
 * Guarded service-worker registration.
 *
 * Refuses to register in dev, Lovable preview hosts, inside iframes, or when
 * `?sw=off` is present. In any refused context it unregisters matching app
 * service workers to avoid stale-cache traps.
 */

const SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;

  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") return true;

  const host = url.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;

  return false;
}

async function unregisterMatching() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const scriptUrl =
            r.active?.scriptURL ?? r.waiting?.scriptURL ?? r.installing?.scriptURL ?? "";
          // Only touch app shell SW — leave messaging workers (firebase, onesignal) alone.
          return scriptUrl.endsWith(SW_PATH);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    // ignore
  }
}

export function registerServiceWorker() {
  if (isRefusedContext()) {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      void unregisterMatching();
    }
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_PATH, { scope: "/" }).catch(() => {
      // swallow registration errors
    });
  });
}
