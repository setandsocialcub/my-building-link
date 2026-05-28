import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";

type Props = {
  /** Optional intro shown above the form */
  title?: string;
  subtitle?: string;
  /** Render children once a session exists */
  children: (user: User) => ReactNode;
};

export function AuthGate({ title = "Sign in or create an account", subtitle, children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = mode === "signup"
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.href },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
  };

  if (!ready) {
    return <main className="min-h-screen grid place-items-center text-muted-foreground">Loading…</main>;
  }

  if (user) return <>{children(user)}</>;

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-background to-muted px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm space-y-4"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </form>
    </main>
  );
}

export async function signOut() {
  await supabase.auth.signOut();
}
