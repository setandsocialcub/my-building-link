import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Home,
  Users,
  Compass,
  Calendar,
  Mail,
  Megaphone,
  ShoppingBag,
  User,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useBuildingSettings, isFeatureEnabled } from "@/hooks/use-building-settings";
import { useBranding } from "@/components/BrandingProvider";
import { brandingValue } from "@/lib/branding";
import { cn } from "@/lib/utils";

type Counts = {
  groupUnread: number;
  dmUnread: number;
  announcementsUnread: number;
};

function useResidentNavContext() {
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>({
    groupUnread: 0,
    dmUnread: 0,
    announcementsUnread: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user || cancelled) return;
      setUserId(auth.user.id);

      const { data: profile } = await supabase
        .from("resident_profiles")
        .select("building_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      const bId = (profile?.building_id as string | undefined) ?? null;
      setBuildingId(bId);

      // Best-effort badge counts; ignore individual failures.
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [dm, ann, annReads] = await Promise.all([
        supabase
          .from("direct_messages")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", auth.user.id)
          .is("read_at", null),
        bId
          ? supabase
              .from("announcements")
              .select("id")
              .eq("building_id", bId)
              .gte("created_at", today.toISOString())
          : Promise.resolve({ data: [] as { id: string }[] }),
        supabase
          .from("announcement_reads")
          .select("announcement_id")
          .eq("user_id", auth.user.id),
      ]);

      if (cancelled) return;
      const readSet = new Set(
        ((annReads as { data: { announcement_id: string }[] | null }).data ?? []).map(
          (r) => r.announcement_id,
        ),
      );
      const todays = ((ann as { data: { id: string }[] | null }).data ?? []).filter(
        (a) => !readSet.has(a.id),
      );
      setCounts({
        groupUnread: 0,
        dmUnread: (dm as { count: number | null }).count ?? 0,
        announcementsUnread: todays.length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { buildingId, userId, counts };
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
      {n > 99 ? "99+" : n}
    </span>
  );
}

function Dot({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="absolute -top-0.5 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
      {n > 9 ? "9+" : n}
    </span>
  );
}

type NavItem = {
  to: string;
  label: string;
  icon: string;
  badge?: number;
  feature?: Parameters<typeof isFeatureEnabled>[1];
  // For dynamic routes that need params
  params?: Record<string, string>;
};

export function ResidentSidebarLinks() {
  const navigate = useNavigate();
  const { buildingId, counts } = useResidentNavContext();
  const { settings } = useBuildingSettings(buildingId);
  const { branding } = useBranding();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const communityName = brandingValue(branding, "community_name");
  const logo = branding?.logo_url;

  const all: NavItem[] = [
    { to: "/announcements", label: "Community Updates", icon: "📢", badge: counts.announcementsUnread },
    { to: "/community-voice", label: "Community Voice™", icon: "🗣️" },
    { to: "/network", label: "Community Network™", icon: "🌐" },
    { to: "/marketplace", label: "Resident Exchange", icon: "🛒", feature: "enable_resident_exchange" },
    { to: "/groups", label: "Circles", icon: "👥", badge: counts.groupUnread, feature: "enable_circles" },
    { to: "/discover", label: "Community Match", icon: "🧭", feature: "enable_ai_matching" },
    { to: "/events", label: "Experiences", icon: "📅", feature: "enable_experiences" },
    { to: "/messages", label: "Conversations", icon: "✉️", badge: counts.dmUnread, feature: "enable_conversations" },
    { to: "/profile", label: "Profile", icon: "👤" },
  ];

  const items = all.filter((it) => !it.feature || isFeatureEnabled(settings, it.feature));

  if (buildingId) {
    items.unshift({
      to: "/building/$buildingId",
      label: "Home",
      icon: "🏠",
      params: { buildingId },
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center overflow-hidden shrink-0">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-base">🏛️</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{communityName}</div>
        </div>
      </div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Community
      </h2>
      <ul className="space-y-1">
        {items.map((it) => {
          const resolvedHref = it.params
            ? it.to.replace(/\$(\w+)/g, (_, k) => it.params![k] ?? "")
            : it.to;
          const active = pathname === resolvedHref;
          const className = cn(
            "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
            active
              ? "bg-primary/10 text-primary font-medium"
              : "hover:bg-muted text-foreground",
          );
          const content = (
            <>
              <span className="text-base leading-none">{it.icon}</span>
              <span className="truncate">{it.label}</span>
              <Badge n={it.badge ?? 0} />
            </>
          );
          return (
            <li key={resolvedHref}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link to={it.to as any} params={it.params as never} className={className}>
                {content}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 pt-3 border-t border-border">
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            toast.success("Signed out");
            navigate({ to: "/" });
          }}
          className="w-full inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export function ResidentBottomNav() {
  const { buildingId, counts } = useResidentNavContext();
  const { settings } = useBuildingSettings(buildingId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  type Tab = {
    to: string;
    params?: Record<string, string>;
    label: string;
    Icon: typeof Home;
    badge?: number;
    active: boolean;
    feature?: Parameters<typeof isFeatureEnabled>[1];
  };

  const allTabs: Tab[] = [
    {
      to: buildingId ? "/building/$buildingId" : "/",
      params: buildingId ? { buildingId } : undefined,
      label: "Home",
      Icon: Home,
      active: pathname.startsWith("/building/"),
    },
    {
      to: "/groups",
      label: "Circles",
      Icon: Users,
      badge: counts.groupUnread,
      active: pathname === "/groups",
      feature: "enable_circles",
    },
    {
      to: "/network",
      label: "Network",
      Icon: Compass,
      active: pathname.startsWith("/network"),
    },
    {
      to: "/events",
      label: "Experiences",
      Icon: Calendar,
      active: pathname === "/events",
      feature: "enable_experiences",
    },
    {
      to: "/messages",
      label: "Conversations",
      Icon: Mail,
      badge: counts.dmUnread,
      active: pathname.startsWith("/messages"),
      feature: "enable_conversations",
    },
  ];

  const tabs = allTabs.filter(
    (t) => !t.feature || isFeatureEnabled(settings, t.feature),
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {tabs.map((t) => (
          <li key={t.label} className="flex-1">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Link
              to={t.to as any}
              params={t.params as never}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium",
                t.active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <t.Icon className="h-5 w-5" />
                <Dot n={t.badge ?? 0} />
              </span>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}


// Spacer to prevent fixed bottom nav from covering page content on mobile.
export function ResidentBottomNavSpacer() {
  return <div className="h-16 md:hidden" aria-hidden />;
}

// Convenience wrapper to drop into any resident page.
export function ResidentNav() {
  return (
    <>
      <ResidentBottomNav />
      <ResidentBottomNavSpacer />
    </>
  );
}

// Re-export icons used by some consumers (avoids unused-import warnings here).
export const _icons = { Megaphone, ShoppingBag, User };
