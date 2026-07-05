import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { GoogleSignInButton, AuthDivider } from "@/components/auth/GoogleSignInButton";
import { toast } from "sonner";
import {
  friendlyAuthError,
  friendlyAuthSuccess,
  validateEmail,
  validatePassword,
} from "@/lib/auth-errors";

export const Route = createFileRoute("/manager-auth")({
  head: () => ({
    meta: [
      { title: "Property Management Portal — Sign In" },
      {
        name: "description",
        content:
          "Sign in or create a property manager account to manage your building.",
      },
    ],
  }),
  component: ManagerAuthPage,
});

function ManagerAuthPage() {
  const navigate = useNavigate();

  // If already signed in, jump straight to the manager flow.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/manager" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/manager" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Property Management Portal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in or create your manager account to continue.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Log In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <SignInForm />
            </TabsContent>

            <TabsContent value="signup">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const emailErr = validateEmail(email);
    if (emailErr) { setErr(emailErr); return; }
    const pwErr = validatePassword(password, "signin");
    if (pwErr) { setErr(pwErr); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setErr(friendlyAuthError(error, "signin"));
      return;
    }
    toast.success(friendlyAuthSuccess("signin"));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <GoogleSignInButton redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/manager`} />
      <AuthDivider />
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <Loader2 className="animate-spin h-4 w-4" /> : "Log In"}
      </Button>
      <Link to="/reset-password" className="block text-xs text-center text-muted-foreground hover:text-foreground">
        Forgot your password?
      </Link>
    </form>
  );
}

function SignUpForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/manager`,
        data: { full_name: name, company },
      },
    });
    setBusy(false);
    if (error) setErr(error.message);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <GoogleSignInButton redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/manager`} label="Sign up with Google" />
      <AuthDivider />
      <div className="space-y-1.5">
        <Label htmlFor="signup-name">Full name</Label>
        <Input
          id="signup-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-company">Company</Label>
        <Input
          id="signup-company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
          autoComplete="organization"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">Work email</Label>
        <Input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <Loader2 className="animate-spin h-4 w-4" /> : "Create Account"}
      </Button>
    </form>
  );
}
