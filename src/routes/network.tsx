import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Sparkles,
  Users,
  Loader2,
  Mail,
  Globe,
  Linkedin,
  Instagram,
  Calendar as CalendarIcon,
  X,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResidentPageShell } from "@/components/ResidentPageShell";
import { signResidentMedia } from "@/lib/resident-media";
import {
  NETWORK_CATEGORIES,
  EXPERT_BADGES,
  badgeById,
  expandSynonyms,
} from "@/lib/network";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Community Network™ — Discover the people in your building" },
      {
        name: "description",
        content:
          "Discover neighbors, professionals, and community experts inside your building — privately and by invitation.",
      },
    ],
  }),
  component: NetworkPage,
});

type NetworkProfile = {
  id: string;
  user_id: string;
  building_id: string;
  first_name: string;
  last_name: string | null;
  professional_title: string | null;
  company: string | null;
  industry: string | null;
  professional_category: string | null;
  service_bio: string | null;
  services_offered: string[];
  community_goals: string[];
  expert_badges: string[];
  interest_tags: string[];
  professional_skills: string[];
  website_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  portfolio_url: string | null;
  calendly_url: string | null;
  business_email: string | null;
  avatar_path: string | null;
  network_audience: string;
};

function NetworkPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ userId: string; profileId: string | null; buildingId: string | null; networkVisible: boolean } | null>(
    null,
  );
  const [profiles, setProfiles] = useState<NetworkProfile[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<NetworkProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data: mine } = await supabase
        .from("resident_profiles")
        .select("id, building_id, network_visible")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      const buildingId = (mine?.building_id as string | undefined) ?? null;
      if (!buildingId) {
        if (!cancelled) {
          setMe({ userId: auth.user.id, profileId: mine?.id ?? null, buildingId: null, networkVisible: !!mine?.network_visible });
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("resident_profiles")
        .select(
          "id, user_id, building_id, first_name, last_name, professional_title, company, industry, professional_category, service_bio, services_offered, community_goals, expert_badges, interest_tags, professional_skills, website_url, linkedin_url, instagram_url, portfolio_url, calendly_url, business_email, avatar_path, network_audience",
        )
        .eq("building_id", buildingId)
        .eq("network_visible", true)
        .neq("network_audience", "hidden")
        .order("first_name", { ascending: true });

      if (cancelled) return;

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      const list = (data as NetworkProfile[] | null) ?? [];
      setProfiles(list);
      setMe({
        userId: auth.user.id,
        profileId: mine?.id ?? null,
        buildingId,
        networkVisible: !!mine?.network_visible,
      });

      // Sign avatar URLs in parallel
      const entries = await Promise.all(
        list
          .filter((p) => p.avatar_path)
          .map(async (p) => {
            const url = await signResidentMedia(p.avatar_path!);
            return [p.id, url] as const;
          }),
      );
      if (!cancelled) {
        setAvatarUrls(Object.fromEntries(entries.filter(([, u]) => !!u) as Array<[string, string]>));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const terms = expandSynonyms(query);
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (category && p.professional_category !== category) return false;
      if (!q) return true;
      const hay = [
        p.first_name,
        p.last_name ?? "",
        p.professional_title ?? "",
        p.company ?? "",
        p.industry ?? "",
        p.professional_category ?? "",
        p.service_bio ?? "",
        ...(p.services_offered ?? []),
        ...(p.interest_tags ?? []),
        ...(p.professional_skills ?? []),
        ...(p.community_goals ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return terms.some((t) => hay.includes(t));
    });
  }, [profiles, query, category]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of profiles) {
      if (p.professional_category) {
        map[p.professional_category] = (map[p.professional_category] ?? 0) + 1;
      }
    }
    return map;
  }, [profiles]);

  return (
    <ResidentPageShell
      title="Community Network™"
      subtitle="Discover the incredible people already living around you."
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-lg text-foreground">
                  The professional & social network for your community
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Every neighbor here has opted in. Search by profession, skill, or interest — send a
                  private introduction to connect.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/network/edit">
                  <Settings className="mr-1.5 h-4 w-4" />
                  {me?.networkVisible ? "Edit my profile" : "Join the network"}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="sticky top-14 z-10 -mx-4 border-y border-border bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border md:px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your community — attorney, chef, yoga, marketing…"
              className="pl-9"
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip active={category === null} onClick={() => setCategory(null)}>
              All
            </FilterChip>
            {NETWORK_CATEGORIES.filter((c) => categoryCounts[c]).map((c) => (
              <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c} <span className="text-muted-foreground">· {categoryCounts[c]}</span>
              </FilterChip>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState visible={!!me?.networkVisible} hasProfiles={profiles.length > 0} query={query} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <NetworkCard
                key={p.id}
                profile={p}
                avatarUrl={avatarUrls[p.id]}
                onOpen={() => setSelected(p)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && me?.profileId && me?.buildingId ? (
        <ProfileDrawer
          profile={selected}
          avatarUrl={avatarUrls[selected.id]}
          onClose={() => setSelected(null)}
          selfProfileId={me.profileId}
          buildingId={me.buildingId}
        />
      ) : null}
    </ResidentPageShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function NetworkCard({
  profile,
  avatarUrl,
  onOpen,
}: {
  profile: NetworkProfile;
  avatarUrl?: string;
  onOpen: () => void;
}) {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const initials = (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? "");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{initials.toUpperCase() || "•"}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-medium text-foreground">{fullName}</h3>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Verified Resident" />
          </div>
          {profile.professional_title ? (
            <p className="truncate text-sm text-muted-foreground">
              {profile.professional_title}
              {profile.company ? ` · ${profile.company}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {profile.service_bio ? (
        <p className="mt-3 line-clamp-3 text-sm text-foreground/80">{profile.service_bio}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile.professional_category ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {profile.professional_category}
          </span>
        ) : null}
        {profile.expert_badges.slice(0, 2).map((id) => {
          const b = badgeById(id);
          if (!b) return null;
          return (
            <span
              key={id}
              className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-foreground"
              title={b.label}
            >
              {b.emoji} {b.label}
            </span>
          );
        })}
        {profile.services_offered.slice(0, 2).map((s) => (
          <span
            key={s}
            className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
        <Sparkles className="h-3 w-3" /> View card
      </div>
    </button>
  );
}

function EmptyState({
  visible,
  hasProfiles,
  query,
}: {
  visible: boolean;
  hasProfiles: boolean;
  query: string;
}) {
  if (query && hasProfiles) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No neighbors matched <span className="font-medium text-foreground">"{query}"</span>. Try a
          different word — search understands synonyms like "attorney" and "lawyer".
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <Users className="mx-auto h-8 w-8 text-muted-foreground/70" />
      <h3 className="mt-3 font-serif text-lg text-foreground">
        Your community network is just getting started
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {visible
          ? "Invite your neighbors to join, or check back soon as more residents opt in."
          : "Be one of the first — add a short professional profile so neighbors can discover you."}
      </p>
      <Button asChild className="mt-4" size="sm">
        <Link to="/network/edit">{visible ? "Edit my profile" : "Join the network"}</Link>
      </Button>
    </div>
  );
}

function ProfileDrawer({
  profile,
  avatarUrl,
  onClose,
  selfProfileId,
  buildingId,
}: {
  profile: NetworkProfile;
  avatarUrl?: string;
  onClose: () => void;
  selfProfileId: string;
  buildingId: string;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const isSelf = profile.id === selfProfileId;
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  const sendIntroduction = async () => {
    if (isSelf) return;
    setSending(true);
    const context = profile.professional_title
      ? `[Community Network — ${profile.professional_title}] `
      : "[Community Network] ";
    const body = message.trim()
      ? `${context}${message.trim()}`
      : `${context}${profile.first_name}, I'd love to connect through Community Network.`;
    const { error } = await supabase.from("resident_introductions").insert({
      building_id: buildingId,
      requester_id: selfProfileId,
      recipient_id: profile.id,
      message: body,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success(`Introduction sent to ${profile.first_name}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-6 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-primary/10 text-2xl font-semibold text-primary">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{(profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? "")}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate font-serif text-xl text-foreground">{fullName}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                <ShieldCheck className="h-3 w-3" /> Verified
              </span>
            </div>
            {profile.professional_title ? (
              <p className="text-sm text-foreground/80">
                {profile.professional_title}
                {profile.company ? ` · ${profile.company}` : ""}
              </p>
            ) : null}
            {profile.industry ? (
              <p className="text-xs text-muted-foreground">{profile.industry}</p>
            ) : null}
          </div>
        </div>

        {profile.service_bio ? (
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              About my services
            </h3>
            <p className="mt-1.5 text-sm text-foreground/90 whitespace-pre-wrap">{profile.service_bio}</p>
          </section>
        ) : null}

        {profile.services_offered.length ? (
          <ChipRow label="Services" items={profile.services_offered} />
        ) : null}
        {profile.expert_badges.length ? (
          <section className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Neighborhood Expert
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {profile.expert_badges.map((id) => {
                const b = badgeById(id);
                if (!b) return null;
                return (
                  <span
                    key={id}
                    className="rounded-full bg-accent/15 px-2 py-1 text-xs font-medium text-accent-foreground"
                  >
                    {b.emoji} {b.label}
                  </span>
                );
              })}
            </div>
          </section>
        ) : null}
        {profile.community_goals.length ? (
          <ChipRow label="Open to" items={profile.community_goals} />
        ) : null}
        {profile.interest_tags.length ? (
          <ChipRow label="Interests" items={profile.interest_tags} />
        ) : null}

        <section className="mt-5 flex flex-wrap gap-2">
          {profile.website_url ? (
            <LinkPill href={profile.website_url} icon={<Globe className="h-3.5 w-3.5" />} label="Website" />
          ) : null}
          {profile.linkedin_url ? (
            <LinkPill href={profile.linkedin_url} icon={<Linkedin className="h-3.5 w-3.5" />} label="LinkedIn" />
          ) : null}
          {profile.instagram_url ? (
            <LinkPill href={profile.instagram_url} icon={<Instagram className="h-3.5 w-3.5" />} label="Instagram" />
          ) : null}
          {profile.calendly_url ? (
            <LinkPill href={profile.calendly_url} icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Schedule" />
          ) : null}
        </section>

        {!isSelf ? (
          <section className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
            <h3 className="font-medium text-foreground">Send introduction</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {profile.first_name} decides whether to accept — then you can message directly.
            </p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder={`Hi ${profile.first_name}, I'd love to connect regarding your ${profile.professional_title ?? "work"}.`}
              className="mt-3"
              disabled={sent}
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={sendIntroduction} disabled={sending || sent}>
                {sent ? (
                  "Introduction sent"
                ) : sending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending
                  </>
                ) : (
                  <>
                    <Mail className="mr-1.5 h-4 w-4" /> Send introduction
                  </>
                )}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  return (
    <section className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span
            key={s}
            className="rounded-full bg-secondary/60 px-2 py-1 text-xs font-medium text-secondary-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </section>
  );
}

function LinkPill({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const safe = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
    >
      {icon}
      {label}
    </a>
  );
}
