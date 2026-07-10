import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResidentPageShell } from "@/components/ResidentPageShell";
import { TagField } from "@/components/TagField";
import {
  NETWORK_CATEGORIES,
  COMMUNITY_GOALS,
  EXPERT_BADGES,
  NETWORK_AUDIENCE_OPTIONS,
  type NetworkAudience,
} from "@/lib/network";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/network/edit")({
  head: () => ({
    meta: [{ title: "My Community Network profile" }],
  }),
  component: NetworkEditPage,
});

function NetworkEditPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const [networkVisible, setNetworkVisible] = useState(false);
  const [audience, setAudience] = useState<NetworkAudience>("building");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [category, setCategory] = useState<string>("");
  const [yearsExp, setYearsExp] = useState<string>("");
  const [serviceBio, setServiceBio] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [calendly, setCalendly] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }
      const { data } = await supabase
        .from("resident_profiles")
        .select(
          "id, network_visible, network_audience, professional_title, company, industry, professional_category, years_experience, service_bio, services_offered, community_goals, expert_badges, website_url, linkedin_url, instagram_url, portfolio_url, calendly_url, business_email, business_phone",
        )
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (cancelled || !data) {
        if (!cancelled) setLoading(false);
        return;
      }
      setProfileId(data.id);
      setNetworkVisible(!!data.network_visible);
      setAudience(((data.network_audience as NetworkAudience | null) ?? "building"));
      setTitle(data.professional_title ?? "");
      setCompany(data.company ?? "");
      setIndustry(data.industry ?? "");
      setCategory(data.professional_category ?? "");
      setYearsExp(data.years_experience != null ? String(data.years_experience) : "");
      setServiceBio(data.service_bio ?? "");
      setServices(data.services_offered ?? []);
      setGoals(data.community_goals ?? []);
      setBadges(data.expert_badges ?? []);
      setWebsite(data.website_url ?? "");
      setLinkedin(data.linkedin_url ?? "");
      setInstagram(data.instagram_url ?? "");
      setPortfolio(data.portfolio_url ?? "");
      setCalendly(data.calendly_url ?? "");
      setBusinessEmail(data.business_email ?? "");
      setBusinessPhone(data.business_phone ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const toggleBadge = (id: string) => {
    setBadges((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };
  const toggleGoal = (g: string) => {
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const save = async () => {
    if (!profileId) return;
    setSaving(true);
    const years = yearsExp.trim() === "" ? null : Number(yearsExp);
    const { error } = await supabase
      .from("resident_profiles")
      .update({
        network_visible: networkVisible,
        network_audience: audience,
        professional_title: title.trim() || null,
        company: company.trim() || null,
        industry: industry.trim() || null,
        professional_category: category || null,
        years_experience: Number.isFinite(years as number) ? (years as number) : null,
        service_bio: serviceBio.trim() || null,
        services_offered: services,
        community_goals: goals,
        expert_badges: badges,
        website_url: website.trim() || null,
        linkedin_url: linkedin.trim() || null,
        instagram_url: instagram.trim() || null,
        portfolio_url: portfolio.trim() || null,
        calendly_url: calendly.trim() || null,
        business_email: businessEmail.trim() || null,
        business_phone: businessPhone.trim() || null,
      })
      .eq("id", profileId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Community Network profile saved");
  };

  if (loading) {
    return (
      <ResidentPageShell title="My Network profile">
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </ResidentPageShell>
    );
  }

  return (
    <ResidentPageShell
      title="Community Network™"
      subtitle="Everything is optional. Share only what you'd like neighbors to know."
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-medium text-foreground">Appear in Community Network</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                You're always in control. Turn this off anytime — your profile stays intact.
              </p>
              <label className="mt-3 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={networkVisible}
                  onChange={(e) => setNetworkVisible(e.target.checked)}
                />
                <span className="text-sm">Yes, include me in Community Network</span>
              </label>
            </div>
          </div>

          {networkVisible ? (
            <div className="mt-4 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Who can see me
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {NETWORK_AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setAudience(opt.value)}
                    className={cn(
                      "rounded-xl border p-3 text-left text-sm transition",
                      audience === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <div className="font-medium text-foreground">{opt.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-serif text-lg text-foreground">Professional profile</h2>
          <p className="text-xs text-muted-foreground">All fields optional.</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Professional title" value={title} onChange={setTitle} placeholder="Interior Designer" />
            <Field label="Company" value={company} onChange={setCompany} />
            <Field label="Industry" value={industry} onChange={setIndustry} placeholder="Design & Architecture" />
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Category
              </Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a category…</option>
                {NETWORK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Years of experience"
              value={yearsExp}
              onChange={setYearsExp}
              type="number"
              placeholder="e.g. 8"
            />
          </div>

          <div className="mt-4">
            <Label htmlFor="service-bio" className="text-xs uppercase tracking-wide text-muted-foreground">
              About my services
            </Label>
            <Textarea
              id="service-bio"
              value={serviceBio}
              onChange={(e) => setServiceBio(e.target.value)}
              rows={4}
              placeholder="I help families redesign homes that feel functional, beautiful and intentional…"
              className="mt-1"
              maxLength={800}
            />
          </div>

          <div className="mt-4">
            <TagField
              id="services"
              label="Services offered"
              hint="Add a few — press Enter after each"
              value={services}
              onChange={setServices}
              placeholder="Consultation"
              suggestions={["Consultation", "Design", "Coaching", "Legal review", "Portfolio review"]}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-serif text-lg text-foreground">Neighborhood Expert™</h2>
          <p className="text-xs text-muted-foreground">
            Optionally identify how you'd like to contribute to the community.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXPERT_BADGES.map((b) => {
              const active = badges.includes(b.id);
              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => toggleBadge(b.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "border-accent bg-accent/15 text-accent-foreground"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <span>{b.emoji}</span> {b.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-serif text-lg text-foreground">Community goals</h2>
          <p className="text-xs text-muted-foreground">What are you open to?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {COMMUNITY_GOALS.map((g) => {
              const active = goals.includes(g);
              return (
                <button
                  type="button"
                  key={g}
                  onClick={() => toggleGoal(g)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-serif text-lg text-foreground">Contact & links</h2>
          <p className="text-xs text-muted-foreground">
            Only what you list here is visible. Personal phone is never shown.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Website" value={website} onChange={setWebsite} placeholder="https://…" />
            <Field label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="https://linkedin.com/in/…" />
            <Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="https://instagram.com/…" />
            <Field label="Portfolio" value={portfolio} onChange={setPortfolio} />
            <Field label="Calendly" value={calendly} onChange={setCalendly} placeholder="https://calendly.com/…" />
            <Field label="Business email" value={businessEmail} onChange={setBusinessEmail} type="email" />
            <Field label="Business phone" value={businessPhone} onChange={setBusinessPhone} />
          </div>
        </section>

        <div className="sticky bottom-16 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="ghost">
              <Link to="/network">
                <Sparkles className="mr-1.5 h-4 w-4" /> View network
              </Link>
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </ResidentPageShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className="mt-1"
      />
    </div>
  );
}
