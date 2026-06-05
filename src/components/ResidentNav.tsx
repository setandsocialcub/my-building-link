import { Link, useRouterState } from "@tanstack/react-router";
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
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
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
          .eq("read", false),
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

export function ResidentSidebarLinks() {
  const { buildingId, counts } = useResidentNavContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items: Array<{
    to: string;
    label: string;
    icon: string;
    badge?: number;
    external?: boolean;
  }> = [
    { to: "/announcements", label: "Announcements", icon: "📢", badge: counts.announcementsUnread },
    { to: "/marketplace", label: "Marketplace", icon: "🛒" },
    { to: "/groups", label: "Groups", icon: "👥", badge: counts.groupUnread },
    { to: "/discover", label: "Discover", icon: "🧭" },
    { to: "/events", label: "Events", icon: "📅" },
    { to: "/messages", label: "Messages", icon: "✉️", badge: counts.dmUnread },
    { to: "/profile", label: "Profile", icon: "👤", external: true },
  ];

  if (buildingId) {
    items.unshift({ to: `/building/${buildingId}`, label: "Home", icon: "🏠", external: true });
  }

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Community
      </h2>
      <ul className="space-y-1">
        {items.map((it) => {
          const active = pathname === it.to;
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
            <li key={it.to}>
              {it.external ? (
                <a href={it.to} className={className}>
                  {content}
                </a>
              ) : (
                <Link to={it.to} className={className}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ResidentBottomNav() {
  const { buildingId, counts } = useResidentNavContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    {
      href: buildingId ? `/building/${buildingId}` : "/",
      label: "Home",
      Icon: Home,
      active: pathname.startsWith("/building/"),
    },
    {
      href: "/groups",
      label: "Groups",
      Icon: Users,
      badge: counts.groupUnread,
      active: pathname === "/groups",
    },
    {
      href: "/discover",
      label: "Discover",
      Icon: Compass,
      active: pathname === "/discover",
    },
    {
      href: "/events",
      label: "Events",
      Icon: Calendar,
      active: pathname === "/events",
    },
    {
      href: "/messages",
      label: "Messages",
      Icon: Mail,
      badge: counts.dmUnread,
      active: pathname.startsWith("/messages"),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {tabs.map((t) => (
          <li key={t.label} className="flex-1">
            <a
              href={t.href}
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
            </a>
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
