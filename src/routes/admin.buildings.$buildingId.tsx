import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  
  Loader2,
  Building2,
  Palette,
  BookOpen,
  Activity,
  UserCog,
  Users,
  CalendarDays,
  BarChart3,
  Map,
  FileText,
  Settings,
  AlertTriangle,
  LogOut,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RoleAwareBackButton } from "@/components/RoleAwareBackButton";

export const Route = createFileRoute("/admin/buildings/$buildingId")({
  head: () => ({
    meta: [
      { title: "Building Administration — Super Admin" },
      { name: "description", content: "Manage a building workspace." },
    ],
  }),
  component: BuildingAdminLayout,
});

type Building = {
  id: string;
  name: string;
  city: string | null;
  status: string | null;
  archived_at: string | null;
};

type AuthState = "loading" | "denied" | "ok";

const NAV: Array<{
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: "primary" | "danger";
}> = [
  { to: "/admin/buildings/$buildingId", label: "Information", icon: Building2 },
  { to: "/admin/buildings/$buildingId/branding", label: "Branding", icon: Palette },
  { to: "/admin/buildings/$buildingId/playbook", label: "Community Playbook", icon: BookOpen },
  { to: "/admin/buildings/$buildingId/pulse", label: "Community Pulse", icon: Activity },
  { to: "/admin/buildings/$buildingId/managers", label: "Managers", icon: UserCog },
  { to: "/admin/buildings/$buildingId/residents", label: "Residents", icon: Users },
  { to: "/admin/buildings/$buildingId/events", label: "Events", icon: CalendarDays },
  { to: "/admin/buildings/$buildingId/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/buildings/$buildingId/neighborhood", label: "Neighborhood Guide", icon: Map },
  { to: "/admin/buildings/$buildingId/legal", label: "Legal Documents", icon: FileText },
  { to: "/admin/buildings/$buildingId/settings", label: "Settings", icon: Settings },
  { to: "/admin/buildings/$buildingId/danger", label: "Danger zone", icon: AlertTriangle, section: "danger" },
];

function BuildingAdminLayout() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [building, setBuilding] = useState<Building | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        navigate({ to: "/super-admin-login" });
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      if (!role) {
        setAuthState("denied");
        return;
      }
      const { data: b } = await (supabase as any)
        .from("buildings")
        .select("id, name, city, status, archived_at")
        .eq("id", buildingId)
        .maybeSingle();
      if (cancelled) return;
      setBuilding((b as Building | null) ?? null);
      setAuthState("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, navigate]);

  if (authState === "loading") {
    return (
      <main className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }
  if (authState === "denied") {
    return (
      <main className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="text-sm text-muted-foreground mt-1">Only super admins can view this page.</p>
        </div>
      </main>
    );
  }

  const isActive = (to: string) => {
    if (to === "/admin/buildings/$buildingId") {
      return pathname === `/admin/buildings/${buildingId}`;
    }
    const suffix = to.replace("/admin/buildings/$buildingId", "");
    return pathname === `/admin/buildings/${buildingId}${suffix}`;
  };

  const status = building?.status ?? "active";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-[1400px] px-4 h-14 flex items-center gap-3">
          <RoleAwareBackButton role="admin" />
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">{building?.name ?? "Building"}</span>
            {building?.city && (
              <span className="text-xs text-muted-foreground truncate">· {building.city}</span>
            )}
            {status !== "active" && (
              <Badge variant="outline" className="ml-1 border-amber-500/40 text-amber-700 dark:text-amber-300 capitalize">
                {status}
              </Badge>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] flex">
        <aside className="w-60 shrink-0 border-r border-border min-h-[calc(100vh-3.5rem)] py-4 hidden md:block">
          <nav className="px-2 space-y-0.5">
            {NAV.filter((n) => n.section !== "danger").map((n) => {
              const Icon = n.icon;
              const active = isActive(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  params={{ buildingId }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
            <div className="my-3 border-t border-border" />
            {NAV.filter((n) => n.section === "danger").map((n) => {
              const Icon = n.icon;
              const active = isActive(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  params={{ buildingId }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-destructive/10 text-destructive font-medium"
                      : "text-muted-foreground hover:text-destructive hover:bg-destructive/5",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
