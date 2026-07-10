import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  MapPin,
  ExternalLink,
  Plus,
  Search,
  Sparkles,
  Star,
  Loader2,
  Gift,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ResidentPageShell } from "@/components/ResidentPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CONCIERGE_CATEGORIES,
  categoryMeta,
  NETWORK_TO_CONCIERGE,
  type ConciergeCategoryId,
} from "@/lib/concierge";
import { cn } from "@/lib/utils";
import { ConciergeChat } from "@/components/ConciergeChat";

export const Route = createFileRoute("/concierge")({
  head: () => ({
    meta: [
      { title: "Community Concierge™" },
      {
        name: "description",
        content:
          "A living hospitality concierge — resident picks, curated partners, and neighbors who serve your community.",
      },
    ],
  }),
  component: ConciergePage,
});

type Place = {
  id: string;
  building_id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  address: string | null;
  description: string | null;
  notes: string | null;
  url: string | null;
  reservation_url: string | null;
  directions_url: string | null;
  image_url: string | null;
  phone: string | null;
  tags: string[];
  collections: string[];
  is_featured: boolean;
  is_perk: boolean;
  perk_description: string | null;
  distance_note: string | null;
  source: string;
  status: string;
  submitted_by: string | null;
  created_at: string;
};

type Neighbor = {
  id: string;
  first_name: string;
  last_name: string | null;
  professional_title: string | null;
  professional_category: string | null;
  service_bio: string | null;
  expert_badges: string[];
};

type UpcomingEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  cover_emoji: string | null;
};

function ConciergePage() {
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [buildingCity, setBuildingCity] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<ConciergeCategoryId | "All" | "Favorites">("All");
  const [query, setQuery] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user || cancelled) return;
      setUserId(auth.user.id);

      const { data: profile } = await supabase
        .from("resident_profiles")
        .select("id, building_id, first_name")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (cancelled || !profile?.building_id) {
        setLoading(false);
        return;
      }
      setBuildingId(profile.building_id);
      setProfileId(profile.id);
      setFirstName(profile.first_name ?? "");

      const nowIso = new Date().toISOString();
      const [placesRes, favRes, neighborsRes, eventsRes, buildingRes] = await Promise.all([
        supabase
          .from("neighborhood_places")
          .select("*")
          .eq("building_id", profile.building_id)
          .order("is_featured", { ascending: false })
          .order("order_index", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase
          .from("concierge_favorites")
          .select("place_id")
          .eq("user_id", auth.user.id),
        supabase
          .from("resident_profiles")
          .select(
            "id, first_name, last_name, professional_title, professional_category, service_bio, expert_badges, network_visible, network_audience",
          )
          .eq("building_id", profile.building_id)
          .eq("network_visible", true)
          .neq("user_id", auth.user.id),
        supabase
          .from("events")
          .select("id, title, description, location, starts_at, cover_emoji, status")
          .eq("building_id", profile.building_id)
          .gte("starts_at", nowIso)
          .order("starts_at", { ascending: true })
          .limit(10),
        supabase.from("buildings").select("city").eq("id", profile.building_id).maybeSingle(),
      ]);

      if (cancelled) return;
      // Filter approved (or my submissions) client-side too (RLS enforces server-side).
      setPlaces(((placesRes.data ?? []) as Place[]).filter((p) => p.status !== "hidden"));
      setFavorites(new Set(((favRes.data ?? []) as { place_id: string }[]).map((f) => f.place_id)));
      setNeighbors(
        ((neighborsRes.data ?? []) as (Neighbor & {
          network_audience: string;
        })[])
          .filter((n) => ["everyone", "building"].includes(n.network_audience ?? "everyone"))
          .filter((n) => n.professional_category || (n.expert_badges ?? []).length > 0),
      );
      setEvents(
        ((eventsRes.data ?? []) as Array<UpcomingEvent & { status: string }>)
          .filter((e) => e.status === "published" || e.status === "active")
          .map(({ status: _s, ...rest }) => rest),
      );
      setBuildingCity((buildingRes.data as { city?: string } | null)?.city ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavorite = async (placeId: string) => {
    if (!userId) return;
    const isFav = favorites.has(placeId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
    if (isFav) {
      await supabase
        .from("concierge_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("place_id", placeId);
    } else {
      const { error } = await supabase
        .from("concierge_favorites")
        .insert({ user_id: userId, place_id: placeId });
      if (error) toast.error("Couldn't save favorite");
    }
  };

  const approvedPlaces = useMemo(
    () => places.filter((p) => p.status === "approved"),
    [places],
  );

  const filtered = useMemo(() => {
    let list = approvedPlaces;
    if (activeCat === "Favorites") {
      list = list.filter((p) => favorites.has(p.id));
    } else if (activeCat !== "All") {
      list = list.filter((p) => p.category === activeCat);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q) ||
          (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [approvedPlaces, activeCat, favorites, query]);

  const featured = useMemo(
    () => approvedPlaces.find((p) => p.is_featured) ?? approvedPlaces[0],
    [approvedPlaces],
  );
  const perks = useMemo(() => approvedPlaces.filter((p) => p.is_perk), [approvedPlaces]);
  const residentPicks = useMemo(
    () => approvedPlaces.filter((p) => p.source === "resident"),
    [approvedPlaces],
  );
  const managementPicks = useMemo(
    () => approvedPlaces.filter((p) => p.source === "manager"),
    [approvedPlaces],
  );

  const neighborsByCategory = useMemo(() => {
    const map = new Map<ConciergeCategoryId, Neighbor[]>();
    for (const n of neighbors) {
      const cat =
        (n.professional_category && NETWORK_TO_CONCIERGE[n.professional_category]) ||
        ("Community Business" as ConciergeCategoryId);
      const arr = map.get(cat) ?? [];
      arr.push(n);
      map.set(cat, arr);
    }
    return map;
  }, [neighbors]);

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (!buildingId && !loading) {
    return (
      <ResidentPageShell title="Community Concierge™">
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Join a building to unlock your concierge.
        </div>
      </ResidentPageShell>
    );
  }

  return (
    <ResidentPageShell title="Community Concierge™">
      <ConciergeChat />
      <div className="space-y-10 pb-10">

        {/* This Week at Home — the first screen */}
        <ThisWeekAtHome
          greeting={greeting}
          firstName={firstName}
          places={approvedPlaces}
          perks={perks}
          neighbors={neighbors}
          events={events}
          city={buildingCity}
        />

        {/* Featured pick */}
        {featured && (
          <section>
            <SectionHeader
              eyebrow="Featured this week"
              title={featured.name}
              subtitle={featured.description ?? featured.notes ?? undefined}
            />
            <FeaturedCard place={featured} onFavorite={toggleFavorite} isFav={favorites.has(featured.id)} />
          </section>
        )}

        {/* Search + submit */}
        <section className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search restaurants, coffee, services…"
              className="pl-9"
            />
          </div>
          <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Recommend a place
              </Button>
            </DialogTrigger>
            <SubmitRecommendationDialog
              buildingId={buildingId}
              profileId={profileId}
              onSubmitted={(p) => {
                setPlaces((prev) => [p, ...prev]);
                setSubmitOpen(false);
                toast.success("Sent to management for review.");
              }}
            />
          </Dialog>
        </section>

        {/* Category chips */}
        <section>
          <div className="flex flex-wrap gap-2">
            <CatChip label="All" active={activeCat === "All"} onClick={() => setActiveCat("All")} />
            <CatChip
              label={`♥ Favorites${favorites.size ? ` · ${favorites.size}` : ""}`}
              active={activeCat === "Favorites"}
              onClick={() => setActiveCat("Favorites")}
            />
            {CONCIERGE_CATEGORIES.map((c) => (
              <CatChip
                key={c.id}
                label={`${c.emoji} ${c.label}`}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
              />
            ))}
          </div>
        </section>

        {/* Results grid */}
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            {activeCat !== "All" &&
              activeCat !== "Favorites" &&
              (neighborsByCategory.get(activeCat) ?? []).length > 0 && (
                <section>
                  <SectionHeader
                    eyebrow="From Community Network™"
                    title={`Neighbors in ${categoryMeta(activeCat)?.label}`}
                    subtitle="Verified residents ready to help."
                  />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(neighborsByCategory.get(activeCat) ?? []).map((n) => (
                      <NeighborCard key={n.id} neighbor={n} />
                    ))}
                  </div>
                </section>
              )}

            <section className="mt-8">
              {filtered.length === 0 ? (
                <EmptyState
                  title={
                    activeCat === "Favorites"
                      ? "No favorites yet"
                      : "No recommendations yet in this category"
                  }
                  subtitle={
                    activeCat === "Favorites"
                      ? "Tap the heart on any place to save it here."
                      : "Be the first — recommend a place your neighbors would love."
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((p) => (
                    <PlaceCard
                      key={p.id}
                      place={p}
                      isFav={favorites.has(p.id)}
                      onFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Resident picks section on All view */}
            {activeCat === "All" && residentPicks.length > 0 && (
              <section className="mt-10">
                <SectionHeader
                  eyebrow="Resident Picks"
                  title="Loved by your neighbors"
                  subtitle="Recommendations submitted by residents in your building."
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {residentPicks.slice(0, 6).map((p) => (
                    <PlaceCard
                      key={p.id}
                      place={p}
                      isFav={favorites.has(p.id)}
                      onFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Perks */}
            {activeCat === "All" && perks.length > 0 && (
              <section className="mt-10">
                <SectionHeader
                  eyebrow="Resident Perks"
                  title="Exclusive to your community"
                  subtitle="Curated partnerships from your property team."
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {perks.map((p) => (
                    <PerkCard key={p.id} place={p} isFav={favorites.has(p.id)} onFavorite={toggleFavorite} />
                  ))}
                </div>
              </section>
            )}

            {/* Community-Owned Businesses */}
            {activeCat === "All" && neighbors.length > 0 && (
              <section className="mt-10">
                <SectionHeader
                  eyebrow="Community-Owned Businesses"
                  title="Support the people who live here"
                  subtitle="Residents from Community Network™ offering their services."
                  action={
                    <Link to="/network" className="text-sm font-medium text-primary hover:underline">
                      Browse network →
                    </Link>
                  }
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {neighbors.slice(0, 6).map((n) => (
                    <NeighborCard key={n.id} neighbor={n} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ResidentPageShell>
  );
}

function CatChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors whitespace-nowrap",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        <h2 className="font-serif text-xl md:text-2xl font-semibold tracking-tight mt-0.5">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function FeaturedCard({
  place,
  onFavorite,
  isFav,
}: {
  place: Place;
  onFavorite: (id: string) => void;
  isFav: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm flex flex-col md:flex-row">
      <div className="relative md:w-64 h-40 md:h-auto bg-muted shrink-0">
        {place.image_url ? (
          <img src={place.image_url} alt={place.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-4xl">
            {categoryMeta(place.category ?? "")?.emoji ?? "✨"}
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge className="bg-primary text-primary-foreground gap-1">
            <Sparkles className="h-3 w-3" /> Today's Pick
          </Badge>
        </div>
      </div>
      <div className="p-5 flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {place.category && (
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{place.category}</p>
            )}
            <h3 className="font-serif text-xl font-semibold mt-0.5 truncate">{place.name}</h3>
          </div>
          <button
            type="button"
            onClick={() => onFavorite(place.id)}
            aria-label={isFav ? "Remove favorite" : "Save favorite"}
            className={cn("shrink-0 rounded-full p-2 transition-colors", isFav ? "text-primary" : "text-muted-foreground hover:text-primary")}
          >
            <Heart className={cn("h-5 w-5", isFav && "fill-current")} />
          </button>
        </div>
        {place.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{place.description}</p>
        )}
        <div className="mt-auto pt-4 flex flex-wrap gap-2">
          {place.reservation_url && (
            <a
              href={place.reservation_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Reserve <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {place.url && (
            <a
              href={place.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs hover:bg-muted"
            >
              Visit <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {place.address && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {place.address}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceCard({
  place,
  isFav,
  onFavorite,
}: {
  place: Place;
  isFav: boolean;
  onFavorite: (id: string) => void;
}) {
  return (
    <article className="group rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="relative h-40 bg-muted">
        {place.image_url ? (
          <img
            src={place.image_url}
            alt={place.name}
            className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-3xl">
            {categoryMeta(place.category ?? "")?.emoji ?? "📍"}
          </div>
        )}
        <button
          type="button"
          onClick={() => onFavorite(place.id)}
          aria-label={isFav ? "Remove favorite" : "Save favorite"}
          className={cn(
            "absolute top-2 right-2 rounded-full bg-background/90 backdrop-blur p-2 shadow-sm",
            isFav ? "text-primary" : "text-muted-foreground hover:text-primary",
          )}
        >
          <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
        </button>
        {place.is_featured && (
          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground gap-1 text-[10px]">
            <Star className="h-3 w-3" /> Featured
          </Badge>
        )}
        {place.source === "resident" && (
          <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px]">
            Resident Pick
          </Badge>
        )}
      </div>
      <div className="p-4">
        {place.category && (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{place.category}</p>
        )}
        <h3 className="font-medium text-base mt-0.5 truncate">{place.name}</h3>
        {place.description && (
          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{place.description}</p>
        )}
        {place.address && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{place.address}</span>
          </div>
        )}
        {(place.tags?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {place.tags!.slice(0, 3).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          {place.url && (
            <a
              href={place.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Visit <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {place.reservation_url && (
            <a
              href={place.reservation_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Reserve
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function PerkCard({
  place,
  isFav,
  onFavorite,
}: {
  place: Place;
  isFav: boolean;
  onFavorite: (id: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
          <Gift className="h-5 w-5" />
        </div>
        <button
          type="button"
          onClick={() => onFavorite(place.id)}
          className={cn("rounded-full p-1.5", isFav ? "text-primary" : "text-muted-foreground hover:text-primary")}
        >
          <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
        </button>
      </div>
      <h3 className="mt-3 font-serif text-lg font-semibold">{place.name}</h3>
      {place.perk_description && (
        <p className="text-sm mt-1.5 text-foreground/80">{place.perk_description}</p>
      )}
      {place.url && (
        <a
          href={place.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Claim perk <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </article>
  );
}

function NeighborCard({ neighbor }: { neighbor: Neighbor }) {
  const displayName = `${neighbor.first_name}${neighbor.last_name ? " " + neighbor.last_name.charAt(0) + "." : ""}`;
  return (
    <Link
      to="/network"
      className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate">{displayName}</div>
          {neighbor.professional_title && (
            <div className="text-xs text-muted-foreground truncate">
              {neighbor.professional_title}
            </div>
          )}
        </div>
      </div>
      {neighbor.service_bio && (
        <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{neighbor.service_bio}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">Neighbor</Badge>
        {neighbor.professional_category && (
          <Badge variant="secondary" className="text-[10px]">
            {neighbor.professional_category}
          </Badge>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="text-3xl mb-2">✨</div>
      <div className="font-medium">{title}</div>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function ThisWeekAtHome({
  picks,
  perks,
  neighbors,
}: {
  picks: Place[];
  perks: Place[];
  neighbors: Neighbor[];
}) {
  const featured = picks.find((p) => p.is_featured) ?? picks[0];
  const coffee = picks.find((p) => p.category === "Coffee");
  const dining = picks.find((p) => p.category === "Restaurants" && p.id !== featured?.id);
  const wellness = picks.find((p) => p.category === "Fitness" || p.category === "Wellness");
  const perk = perks[0];
  const meetNeighbor = neighbors[0];

  const items: Array<{ icon: string; label: string; body: string | null; href?: string }> = [
    dining && { icon: "🍽️", label: "Dining spotlight", body: dining.name, href: dining.url ?? undefined },
    coffee && { icon: "☕", label: "Coffee of the week", body: coffee.name, href: coffee.url ?? undefined },
    wellness && { icon: "💪", label: "Fitness spotlight", body: wellness.name, href: wellness.url ?? undefined },
    perk && { icon: "🎁", label: "New resident perk", body: perk.name, href: perk.url ?? undefined },
    meetNeighbor && {
      icon: "👋",
      label: "Meet a neighbor",
      body: `${meetNeighbor.first_name}${meetNeighbor.professional_title ? " — " + meetNeighbor.professional_title : ""}`,
      href: "/network",
    },
  ].filter(Boolean) as Array<{ icon: string; label: string; body: string; href?: string }>;

  if (items.length === 0) return null;

  return (
    <section>
      <SectionHeader
        eyebrow="This Week at Home"
        title="Your weekly briefing"
        subtitle="Handpicked highlights around your community."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <a
            key={i}
            href={it.href ?? "#"}
            target={it.href?.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
          >
            <div className="text-2xl">{it.icon}</div>
            <div className="mt-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              {it.label}
            </div>
            <div className="font-medium mt-0.5">{it.body}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

function SubmitRecommendationDialog({
  buildingId,
  profileId,
  onSubmitted,
}: {
  buildingId: string | null;
  profileId: string | null;
  onSubmitted: (p: Place) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!buildingId || !profileId) return;
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    const { data, error } = await supabase
      .from("neighborhood_places")
      .insert({
        building_id: buildingId,
        submitted_by: profileId,
        source: "resident",
        status: "pending",
        name: name.trim(),
        category: category || null,
        description: description.trim() || null,
        address: address.trim() || null,
        url: url.trim() || null,
        order_index: 0,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSubmitted(data as Place);
    setName("");
    setCategory("");
    setDescription("");
    setAddress("");
    setUrl("");
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Recommend a place</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday Coffee" />
        </div>
        <div>
          <Label>Category</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Choose a category…</option>
            {CONCIERGE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Why residents will love it</Label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Share what makes this place special."
          />
        </div>
        <div>
          <Label>Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <Label>Website</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </div>
        <p className="text-xs text-muted-foreground">
          Your recommendation is reviewed by property management before appearing to residents.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit for review
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
