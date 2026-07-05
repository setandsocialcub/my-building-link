import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Role = "admin" | "manager" | "resident";

type Target = {
  to: string;
  label: string;
};

const TARGETS: Record<Role, Target> = {
  admin: { to: "/admin", label: "Back to Buildings" },
  manager: { to: "/manager", label: "Back to Dashboard" },
  resident: { to: "/", label: "Back to Home" },
};

/**
 * Role-aware back navigation.
 *
 * - Admins → /admin (Buildings)
 * - Managers → /manager (Dashboard)
 * - Residents (or signed-out) → / (Home)
 *
 * Prefers browser history when the previous entry is same-origin so we
 * preserve scroll position and tab state. Falls back to a router Link
 * navigation so the user is never accidentally logged out.
 */
export function RoleAwareBackButton({
  role: roleProp,
  className,
  fallback,
}: {
  role?: Role;
  className?: string;
  fallback?: Role;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(roleProp ?? null);

  useEffect(() => {
    if (roleProp) {
      setRole(roleProp);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        if (!cancelled) setRole(fallback ?? "resident");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (cancelled) return;
      const set = new Set((roles ?? []).map((r: { role: string }) => r.role));
      if (set.has("admin")) setRole("admin");
      else if (set.has("moderator")) setRole("manager");
      else {
        // Check manager membership
        const { data: mgr } = await supabase
          .from("property_managers")
          .select("id")
          .eq("user_id", uid)
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        setRole(mgr ? "manager" : (fallback ?? "resident"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roleProp, fallback]);

  const target = TARGETS[role ?? fallback ?? "resident"];

  const handleClick = (e: React.MouseEvent) => {
    // If there's a same-origin previous entry, prefer history back so the
    // user returns to where they were with scroll preserved.
    if (typeof window === "undefined") return;
    const ref = document.referrer;
    if (window.history.length > 1 && ref && ref.startsWith(window.location.origin)) {
      e.preventDefault();
      router.history.back();
    }
  };

  return (
    <Link
      to={target.to}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" /> {target.label}
    </Link>
  );
}
