import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { lovable } from "@/integrations/lovable";
import { useBranding } from "@/components/BrandingProvider";
import { brandingValue } from "@/lib/branding";

type Props = {
  /** Optional intro shown above the form */
  title?: string;
  subtitle?: string;
  /** Render children once a session exists */
  children: (user: User) => ReactNode;
};

export function AuthGate({ title = "Sign in or create an account", subtitle, children }: Props) {
  const { branding } = useBranding();
  const communityName = brandingValue(branding, "community_name");
  const communityLogo = branding?.logo_url ?? branding?.community_icon_url ?? null;
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

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

  const rememberLegalAcceptance = () => {
    if (typeof window === "undefined") return;
    const now = new Date().toISOString();
    try {
      localStorage.setItem("legal:acceptedTermsAt", now);
      localStorage.setItem("legal:acceptedPrivacyAt", now);
    } catch {
      /* ignore storage errors */
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (mode === "signup" && (!acceptedTerms || !acceptedPrivacy)) {
      setErr("Please agree to the Terms of Use and acknowledge the Privacy Policy.");
      return;
    }
    setBusy(true);
    const { error } = mode === "signup"
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.href },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (mode === "signup") rememberLegalAcceptance();
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
        <div className="flex items-center gap-3">
          {communityLogo ? (
            <img
              src={communityLogo}
              alt=""
              className="h-11 w-11 rounded-xl object-cover ring-1 ring-border"
            />
          ) : (
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center text-lg">
              🏛️
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground truncate">
              {communityName}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={async () => {
            setErr(null);
            if (mode === "signup" && (!acceptedTerms || !acceptedPrivacy)) {
              setErr("Please agree to the Terms of Use and acknowledge the Privacy Policy.");
              return;
            }
            if (mode === "signup") rememberLegalAcceptance();
            const result = await lovable.auth.signInWithOAuth("google", {
              redirect_uri: window.location.href,
            });
            if (result.error) setErr(result.error.message ?? "Google sign-in failed");
          }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
            <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
          </svg>
          Continue with Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
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
        {mode === "signup" && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
            <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
              <Checkbox
                checked={acceptedTerms}
                onCheckedChange={(c) => setAcceptedTerms(c === true)}
                className="mt-0.5"
              />
              <span>
                I agree to the{" "}
                <Link to="/terms" target="_blank" className="underline text-primary">
                  Terms of Use
                </Link>
                .
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
              <Checkbox
                checked={acceptedPrivacy}
                onCheckedChange={(c) => setAcceptedPrivacy(c === true)}
                className="mt-0.5"
              />
              <span>
                I acknowledge the{" "}
                <Link to="/privacy" target="_blank" className="underline text-primary">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>
        )}
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
        <div className="pt-2 text-center text-[11px] text-muted-foreground space-x-2">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <span aria-hidden="true">·</span>
          <Link to="/community-standards" className="hover:text-foreground">Community Standards</Link>
        </div>
      </form>
    </main>
  );
}

export async function signOut() {
  await supabase.auth.signOut();
}
