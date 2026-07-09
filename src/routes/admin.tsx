import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — Buildings" },
      { name: "description", content: "Manage buildings and access codes." },
    ],
  }),
  component: AdminLayout,
});

type AuthState = "loading" | "not-admin" | "admin";

function AdminLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>("loading");

  const check = async (preloadedUserId?: string | null) => {
    try {
      let userId = preloadedUserId;
      if (userId === undefined) {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user?.id ?? null;
      }
      if (!userId) {
        navigate({ to: "/super-admin-login" });
        return;
      }
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (rErr) {
        console.error("[admin] role check failed", rErr);
        return setState("not-admin");
      }
      setState(roles ? "admin" : "not-admin");
    } catch (e) {
      console.error("[admin] auth check failed", e);
      navigate({ to: "/super-admin-login" });
    }
  };

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await check(data.session?.user?.id ?? null);
      settled = true;
    };
    run();

    const timeout = setTimeout(() => {
      if (!settled && !cancelled) {
        navigate({ to: "/super-admin-login" });
      }
    }, 5000);

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) {
        navigate({ to: "/super-admin-login" });
        return;
      }
      check(session.user.id);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (state === "loading") {
    return <main className="min-h-screen grid place-items-center text-muted-foreground">Loading…</main>;
  }

  if (state === "not-admin") {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-6">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="text-sm text-muted-foreground">This account is not an admin. Only the Super Admin can manage buildings.</p>
          <Button variant="outline" onClick={signOut} className="gap-2"><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </main>
    );
  }

  return <Outlet />;
}
