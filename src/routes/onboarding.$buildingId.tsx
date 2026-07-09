import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AuthGate } from "@/components/AuthGate";
import { CircleRecommendations } from "@/components/CircleRecommendations";
import { PrivacyLevelPicker } from "@/components/PrivacyLevelPicker";
import type { PrivacyLevel } from "@/lib/privacy";

export const Route = createFileRoute("/onboarding/$buildingId")({
  component: OnboardingRoute,
});

const INTEREST_CATEGORIES = {
  "Wellness & Movement": [
    "Running", "Cycling", "Yoga", "Strength Training",
    "Swimming", "Hiking", "Dance", "Tennis", "Pilates"
  ],
  "Food & Drink": [
    "Cooking", "Wine", "Cocktails", "Coffee",
    "Vegan & Plant-Based", "Baking", "Restaurant Hunting"
  ],
  "Arts & Culture": [
    "Music", "Live Music & Concerts", "Photography",
    "Film & Cinema", "Reading & Books", "Visual Art", "Writing"
  ],
  "Career & Professional": [
    "Tech & Startups", "Finance & Investing",
    "Entrepreneurship", "Creative Industries", "Real Estate"
  ],
  "Lifestyle & Social": [
    "Pets & Dogs", "Parenting & Kids", "Travel", "Gaming",
    "Sustainability", "Sports Watching", "Meditation", "Board Games"
  ],
  "Building Life": [
    "New to the Building", "New to the City",
    "Remote Worker", "Looking for Running Buddy", "Looking for Carpool"
  ],
} as const;

const ALL_INTEREST_TAGS = Object.values(INTEREST_CATEGORIES).flat();

type Step = 1 | 2 | 3 | 4 | 5;

function OnboardingRoute() {
  const { buildingId } = Route.useParams();
  return (
    <AuthGate
      title="Create your resident account"
      subtitle="You'll use this to sign in to your building hub."
    >
      {(user) => <OnboardingPage buildingId={buildingId} user={user} />}
    </AuthGate>
  );
}

function OnboardingPage({ buildingId, user }: { buildingId: string; user: User }) {
  const navigate = useNavigate();
  const [building, setBuilding] = useState<{ name: string; city: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [checking, setChecking] = useState(true);

  const [step, setStep] = useState<Step>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. If a profile already exists for this user + building, skip onboarding.
      const { data: existing } = await supabase
        .from("resident_profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("building_id", buildingId)
        .maybeSingle();
      if (cancelled) return;
      if (existing) {
        navigate({ to: "/building/$buildingId", params: { buildingId } });
        return;
      }

      // 2. Load building context. Prefer the cached lookup from the landing
      //    page (works before the resident profile is created, so RLS on
      //    buildings doesn't block us). Re-validate by access code if we have it.
      let cached: { name: string; city: string; code?: string } | null = null;
      try {
        const raw = sessionStorage.getItem(`building:${buildingId}`);
        if (raw) cached = JSON.parse(raw);
      } catch {
        cached = null;
      }

      if (cached?.code) {
        const { data: verified } = await supabase
          .rpc("lookup_building_by_code", { _code: cached.code })
          .maybeSingle();
        if (cancelled) return;
        if (!verified || verified.id !== buildingId) {
          setNotFound(true);
          setChecking(false);
          return;
        }
        setBuilding({ name: verified.name, city: verified.city });
      } else if (cached) {
        setBuilding({ name: cached.name, city: cached.city });
      } else {
        // No cached access code — try the access-gated RPC (only succeeds
        // for managers/admins/existing residents). Otherwise bounce to /.
        const { data: b } = await supabase
          .rpc("get_building_info", { _building_id: buildingId })
          .maybeSingle();
        if (cancelled) return;
        if (!b) {
          setNotFound(true);
          setChecking(false);
          return;
        }
        setBuilding({ name: b.name, city: b.city });
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, user.id, navigate]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const canAdvanceStep1 = firstName.trim().length > 0 && lastName.trim().length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    // Read acceptance timestamps captured at registration time (AuthGate).
    let acceptedTermsAt: string | null = null;
    let acceptedPrivacyAt: string | null = null;
    if (typeof window !== "undefined") {
      try {
        acceptedTermsAt = localStorage.getItem("legal:acceptedTermsAt");
        acceptedPrivacyAt = localStorage.getItem("legal:acceptedPrivacyAt");
      } catch {
        /* ignore */
      }
    }
    // Fallback for users who signed up before this flow existed: stamp now.
    const now = new Date().toISOString();
    if (!acceptedTermsAt) acceptedTermsAt = now;
    if (!acceptedPrivacyAt) acceptedPrivacyAt = now;

    // Fetch current legal document versions to record what the user accepted.
    const [termsDoc, privacyDoc] = await Promise.all([
      supabase.from("legal_documents").select("version").eq("slug", "terms").eq("is_current", true).maybeSingle(),
      supabase.from("legal_documents").select("version").eq("slug", "privacy").eq("is_current", true).maybeSingle(),
    ]);

    // Access code proves the user has permission to join this building.
    let cachedCode: string | null = null;
    try {
      const raw = sessionStorage.getItem(`building:${buildingId}`);
      if (raw) cachedCode = (JSON.parse(raw)?.code as string | undefined) ?? null;
    } catch {
      cachedCode = null;
    }
    if (!cachedCode) {
      setError("Your building invitation has expired. Please re-enter your building access code.");
      setSubmitting(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .rpc("join_building_as_resident", {
        _access_code: cachedCode,
        _first_name: firstName.trim(),
        _last_name: lastName.trim() || undefined,
        _job_title: jobTitle.trim() || undefined,
        _interest_tags: interests,
        _privacy_level: privacyLevel,
        _accepted_terms_at: acceptedTermsAt,
        _accepted_privacy_at: acceptedPrivacyAt,
        _accepted_terms_version: termsDoc.data?.version ?? undefined,
        _accepted_privacy_version: privacyDoc.data?.version ?? undefined,
      })
      .maybeSingle();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create profile. Try again.");
      setSubmitting(false);
      return;
    }

    // Backfill privacy_level (RPC currently does not accept it in older schema — safe upsert).
    await supabase
      .from("resident_profiles")
      .update({ privacy_level: privacyLevel })
      .eq("id", data.profile_id);

    setSubmitting(false);
    setStep(5);
  };

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Building not found</h1>
          <Link to="/" className="text-sm text-primary underline mt-3 inline-block">
            Back to access
          </Link>
        </div>
      </main>
    );
  }

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted px-4 py-12">
      <div className="max-w-xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex items-center gap-2 text-primary mb-3">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">Access verified</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Welcome to {building?.name ?? "your building"}
        </h1>
        {building?.city && (
          <p className="text-sm text-muted-foreground mt-1">
            {building.city} — let&apos;s set up your resident profile.
          </p>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-8 mb-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                n <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-4">Step {step} of 5</p>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Your name</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Only your first name is shown to neighbors. Your last name stays private.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Alex"
                  autoFocus
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last name <span className="text-muted-foreground font-normal">(private)</span>
                </Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Rivera"
                  maxLength={80}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} disabled={!canAdvanceStep1}>
                  Continue <ArrowRight />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">What do you do?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Optional. Helps neighbors with shared interests find you.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job title or industry</Label>
                <Input
                  id="jobTitle"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Product designer, Finance, Architect…"
                  maxLength={120}
                  autoFocus
                />
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft /> Back
                </Button>
                <Button onClick={() => setStep(3)}>
                  Continue <ArrowRight />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Pick your interests</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Select all that apply. These appear on your public profile.
                </p>
              </div>
              <div className="space-y-6">
                {Object.entries(INTEREST_CATEGORIES).map(([category, tags]) => (
                  <div key={category}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {tags.map((tag) => {
                        const selected = interests.includes(tag);
                        return (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => toggleInterest(tag)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors cursor-pointer",
                              selected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/40 hover:bg-muted/50",
                            )}
                          >
                            <Checkbox checked={selected} tabIndex={-1} />
                            <span className="font-medium">{tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={submitting}>
                  <ArrowLeft /> Back
                </Button>
                <Button onClick={() => setStep(4)}>
                  Continue <ArrowRight />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Choose your privacy</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  You decide what neighbors can see. You can change this anytime from your profile. Managers always see the full profile. Accepted introductions unlock full details for that person.
                </p>
              </div>
              <PrivacyLevelPicker value={privacyLevel} onChange={setPrivacyLevel} />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(3)} disabled={submitting}>
                  <ArrowLeft /> Back
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <ArrowRight /> Continue
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Discover your circles</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Hand-picked from the interests you just chose. Join now or skip and explore later.
                </p>
              </div>
              <CircleRecommendations
                buildingId={buildingId}
                interests={interests}
                userId={user.id}
                limit={6}
                title="Circles you may love"
                subtitle="Tap Join to be added instantly."
              />
              <div className="flex justify-between pt-2">
                <Link to="/groups" className="text-sm text-muted-foreground hover:text-foreground self-center">
                  Browse all circles
                </Link>
                <Button onClick={() => navigate({ to: "/building/$buildingId", params: { buildingId } })}>
                  <Sparkles /> Enter hub
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
