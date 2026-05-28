import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/building/$buildingId")({
  component: BuildingHub,
});

type PublicProfile = {
  id: string;
  first_name: string;
  job_title: string | null;
  interest_tags: string[];
};

function BuildingHub() {
  const { buildingId } = Route.useParams();
  const [building, setBuilding] = useState<{ name: string; city: string } | null>(null);
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: p }] = await Promise.all([
        supabase.from("buildings").select("name, city").eq("id", buildingId).maybeSingle(),
        supabase
          .from("resident_public_profiles")
          .select("id, first_name, job_title, interest_tags")
          .eq("building_id", buildingId)
          .order("created_at", { ascending: false }),
      ]);
      setBuilding(b);
      setProfiles((p as PublicProfile[] | null) ?? []);
      setLoading(false);
    })();
  }, [buildingId]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Exit
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-content-center">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {building?.name ?? "Building Hub"}
            </h1>
            {building && (
              <p className="text-sm text-muted-foreground">{building.city}</p>
            )}
          </div>
        </div>

        <section className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Your neighbors ({profiles.length})
            </h2>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : profiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">
                You&apos;re the first resident here. Invite your neighbors with the building access code.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profiles.map((profile) => (
                <article
                  key={profile.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <h3 className="text-base font-semibold">{profile.first_name}</h3>
                  {profile.job_title && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {profile.job_title}
                    </p>
                  )}
                  {profile.interest_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {profile.interest_tags.map((t) => (
                        <Badge key={t} variant="secondary" className="font-normal">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
