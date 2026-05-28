import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding/$buildingId")({
  component: OnboardingPage,
});

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

type Step = 1 | 2 | 3;

function OnboardingPage() {
  const { buildingId } = Route.useParams();
  const navigate = useNavigate();
  const [building, setBuilding] = useState<{ name: string; city: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("buildings")
        .select("name, city")
        .eq("id", buildingId)
        .maybeSingle();
      if (!data) setNotFound(true);
      else setBuilding(data);
    })();
  }, [buildingId]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const canAdvanceStep1 = firstName.trim().length > 0 && lastName.trim().length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("resident_profiles")
      .insert({
        building_id: buildingId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        job_title: jobTitle.trim() || null,
        interest_tags: interests,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create profile. Try again.");
      setSubmitting(false);
      return;
    }

    try {
      localStorage.setItem(`resident_profile_${buildingId}`, data.id);
    } catch {
      // ignore storage failures
    }

    navigate({ to: "/building/$buildingId", params: { buildingId } });
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
        {building && (
          <p className="text-sm text-muted-foreground mt-1">
            {building.city} — let&apos;s set up your resident profile.
          </p>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-8 mb-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                n <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-4">Step {step} of 3</p>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {INTEREST_TAGS.map((tag) => {
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

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={submitting}>
                  <ArrowLeft /> Back
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Sparkles /> Finish & enter hub
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
