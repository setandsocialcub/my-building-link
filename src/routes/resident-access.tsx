import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { GoogleSignInButton, AuthDivider } from "@/components/auth/GoogleSignInButton";
import { friendlyAuthError, validateEmail, validatePassword } from "@/lib/auth-errors";

export const Route = createFileRoute("/resident-access")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Resident Access — Join Your Building" },
      {
        name: "description",
        content:
          "Use your building invitation code or sign in to your resident community.",
      },
    ],
  }),
  component: ResidentAccessPage,
});

type View = "choice" | "code" | "login";

function ResidentAccessPage() {
  const { code: codeFromUrl } = Route.useSearch();
  const initialCode = (codeFromUrl ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 7);
  const [view, setView] = useState<View>(initialCode ? "code" : "choice");

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {view === "choice" && <ChoiceView onPick={setView} />}
        {view === "code" && (
          <CodeView
            onBack={() => setView("choice")}
            initialCode={initialCode}
            prefilled={Boolean(initialCode)}
          />
        )}
        {view === "login" && <LoginView onBack={() => setView("choice")} />}
      </div>
    </main>
  );
}


function ChoiceView({ onPick }: { onPick: (v: View) => void }) {
  return (
    <div>
      <div className="text-center mb-10">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
          <Building2 className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Welcome, resident
        </h1>
        <p className="mt-2 text-muted-foreground">
          Do you have a Building Invitation Code?
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => onPick("code")}
          className="group w-full text-left rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary hover:shadow-md transition-all flex items-center gap-4"
        >
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-foreground">Yes, I have a code</h2>
            <p className="text-sm text-muted-foreground">
              Enter your 6-character invitation.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          onClick={() => onPick("login")}
          className="group w-full text-left rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary hover:shadow-md transition-all flex items-center gap-4"
        >
          <div className="h-11 w-11 rounded-xl bg-muted text-foreground grid place-items-center flex-shrink-0">
            <LogIn className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-foreground">
              I already have an account
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in with email and password.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Code path                                                                  */
/* -------------------------------------------------------------------------- */

const INTEREST_TAGS = [
  "Wellness & Fitness",
  "Professional Networking",
  "Sports",
  "Running",
  "Gaming",
  "Food & Cooking",
  "Pets",
  "Arts & Culture",
] as const;

type Building = { id: string; name: string; city: string };

function normalizeCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}

function CodeView({
  onBack,
  initialCode = "",
  prefilled = false,
}: {
  onBack: () => void;
  initialCode?: string;
  prefilled?: boolean;
}) {
  const [code, setCode] = useState(() => normalizeCode(initialCode));
  const [checking, setChecking] = useState(false);
  const [building, setBuilding] = useState<Building | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live validation once the full AAA-NNN code is entered
  useEffect(() => {
    const trimmed = code.trim().toUpperCase();
    if (!/^[A-Z]{3}-[0-9]{3}$/.test(trimmed)) {
      setBuilding(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    setError(null);
    supabase
      .rpc("lookup_building_by_code", { _code: trimmed })
      .maybeSingle()
      .then(({ data, error: qErr }) => {
        if (cancelled) return;
        setChecking(false);
        if (qErr) {
          setError("Couldn't verify the code. Try again.");
          setBuilding(null);
          return;
        }
        if (!data) {
          setError("This code didn't match any building.");
          setBuilding(null);
          return;
        }
        setBuilding(data as Building);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div>
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        ← Choose a different option
      </button>
      <div className="text-center mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Enter your invitation code
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {prefilled
            ? "We pre-filled your invitation code from the link."
            : "Your building manager shared a 7-character code."}
        </p>
      </div>

      <div
        className={cn(
          "rounded-2xl border bg-card p-6 shadow-sm transition-all",
          prefilled
            ? "border-primary ring-2 ring-primary/30 shadow-md"
            : "border-border",
        )}
      >
        <Input
          autoFocus
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="A B C - 1 2 3"
          maxLength={7}
          inputMode="text"
          autoCapitalize="characters"
          className="h-16 text-center text-2xl font-mono tracking-[0.4em] uppercase"
        />

        <div className="mt-3 min-h-[1.25rem] text-center text-sm">
          {checking && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…
            </span>
          )}
          {!checking && error && <span className="text-destructive">{error}</span>}
        </div>
      </div>

      {/* Success banner + sliding profile card */}
      <div
        className={cn(
          "grid transition-all duration-500 ease-out",
          building ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          {building && (
            <>
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium text-foreground">Success!</span>{" "}
                  <span className="text-muted-foreground">
                    Code verified for{" "}
                  </span>
                  <span className="font-semibold text-foreground">
                    {building.name}
                  </span>
                  <span className="text-muted-foreground">.</span>
                </p>
              </div>
              <ProfileCreationCard building={building} accessCode={code} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileCreationCard({ building }: { building: Building }) {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (tag: string) =>
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim()) return setError("Please enter your first name.");
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);
    const pwErr = validatePassword(password, "signup");
    if (pwErr) return setError(pwErr);

    setBusy(true);
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/building/${building.id}`,
        data: { first_name: firstName.trim() },
      },
    });

    if (signUpErr) {
      setBusy(false);
      setError(friendlyAuthError(signUpErr, "signup"));
      return;
    }

    // Ensure we have a session before inserting (auto-confirm is on).
    let userId = signUpData.user?.id;
    if (!userId) {
      const { data: u } = await supabase.auth.getUser();
      userId = u.user?.id;
    }
    if (!userId) {
      // Account created but needs email confirmation.
      setBusy(false);
      setError("Check your email to confirm your account, then sign in.");
      return;
    }

    const { error: insErr } = await supabase.rpc("join_building_as_resident", {
      _access_code: building.access_code ?? "",
      _first_name: firstName.trim(),
      _job_title: jobTitle.trim() || null,
      _interest_tags: interests,
    });

    setBusy(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }

    navigate({ to: "/building/$buildingId", params: { buildingId: building.id } });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Create your profile
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Just a few things so your neighbors can say hi.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="first-name">First name</Label>
        <Input
          id="first-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          autoComplete="given-name"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="job-title">
          Job title <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="job-title"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. Product Designer"
        />
      </div>

      <div className="space-y-2">
        <Label>Interests</Label>
        <div className="grid grid-cols-2 gap-2">
          {INTEREST_TAGS.map((tag) => {
            const active = interests.includes(tag);
            return (
              <button
                type="button"
                key={tag}
                onClick={() => toggle(tag)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm text-left transition-all",
                  active
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          autoComplete="new-password"
          required
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={busy} className="w-full h-11">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Join Building Community"
        )}
      </Button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Login path                                                                 */
/* -------------------------------------------------------------------------- */

function LoginView({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    const pwErr = validatePassword(password, "signin");
    if (pwErr) { setError(pwErr); return; }
    setBusy(true);
    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInErr || !data.user) {
      setBusy(false);
      setError(friendlyAuthError(signInErr ?? new Error("Sign in failed."), "signin"));
      return;
    }

    // Find which building this resident belongs to.
    const { data: profile, error: pErr } = await supabase
      .from("resident_profiles")
      .select("building_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    setBusy(false);
    if (pErr) {
      setError(pErr.message);
      return;
    }
    if (!profile) {
      setError("This account isn't linked to a building yet. Ask your property manager for an invitation code.");
      return;
    }
    navigate({
      to: "/building/$buildingId",
      params: { buildingId: profile.building_id },
    });
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        ← Choose a different option
      </button>
      <div className="text-center mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground mb-4">
          <LogIn className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to your resident account.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4"
      >
        <GoogleSignInButton />
        <AuthDivider />
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
        </Button>
        <Link to="/reset-password" className="block text-xs text-center text-muted-foreground hover:text-foreground">
          Forgot your password?
        </Link>
      </form>
    </div>
  );
}
