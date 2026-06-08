import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/connections")({
  component: ConnectionsPage,
});

type ConnectionRow = {
  id: string;
  building_id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

type ProfileRow = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  interest_tags: string[];
};

type MyProfile = {
  id: string;
  building_id: string;
  first_name: string;
  last_name: string | null;
  interest_tags: string[];
};

function initialsFor(firstName: string, lastName: string | null) {
  const f = firstName?.[0] ?? "?";
  const l = lastName?.[0] ?? "";
  return (f + l).toUpperCase();
}

function displayName(firstName: string, lastName: string | null) {
  return lastName ? `${firstName} ${lastName[0]}.` : firstName;
}

function ConnectionsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [activeTab, setActiveTab] = useState<"neighbors" | "requests">("neighbors");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Load me, connections, and peer profiles
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }

      const { data: profilesData, error: pErr } = await supabase
        .from("resident_profiles")
        .select("id, building_id, first_name, last_name, interest_tags")
        .eq("user_id", auth.user.id)
        .limit(1);

      if (pErr || !profilesData || profilesData.length === 0) {
        toast.error("Join a building first to manage connections.");
        navigate({ to: "/resident-access" });
        return;
      }

      const mine = profilesData[0] as MyProfile;

      const { data: conns, error: cErr } = await supabase
        .from("connections")
        .select("id, building_id, requester_id, addressee_id, status, created_at")
        .or(`requester_id.eq.${mine.id},addressee_id.eq.${mine.id}`);

      if (cancelled) return;
      if (cErr) {
        toast.error(cErr.message);
        setLoading(false);
        return;
      }

      const connList = (conns ?? []) as ConnectionRow[];
      const otherIds = connList.map((c) =>
        c.requester_id === mine.id ? c.addressee_id : c.requester_id,
      );

      let profileMap: Record<string, ProfileRow> = {};
      if (otherIds.length > 0) {
        const { data: peers } = await supabase
          .from("resident_profiles")
          .select("id, user_id, first_name, last_name, job_title, interest_tags")
          .in("id", [...new Set(otherIds)]);

        for (const p of (peers ?? []) as ProfileRow[]) {
          profileMap[p.id] = p;
        }
      }

      if (!cancelled) {
        setMe(mine);
        setConnections(connList);
        setProfiles(profileMap);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Realtime subscription for connections affecting the current user
  useEffect(() => {
    if (!me) return;
    const sub = supabase
      .channel(`connections-${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
        },
        (payload) => {
          const row = payload.new as ConnectionRow | undefined;
          const old = payload.old as ConnectionRow | undefined;
          const relevant = row
            ? row.requester_id === me.id || row.addressee_id === me.id
            : old
              ? old.requester_id === me.id || old.addressee_id === me.id
              : false;
          if (!relevant) return;

          if (payload.eventType === "INSERT" && row) {
            setConnections((prev) => {
              if (prev.some((c) => c.id === row.id)) return prev;
              return [...prev, row];
            });
            // fetch peer profile if missing
            const otherId =
              row.requester_id === me.id ? row.addressee_id : row.requester_id;
            if (!profiles[otherId]) {
              supabase
                .from("resident_profiles")
                .select("id, user_id, first_name, last_name, job_title, interest_tags")
                .eq("id", otherId)
                .single()
                .then(({ data }) => {
                  if (data) {
                    setProfiles((prev) => ({
                      ...prev,
                      [data.id]: data as ProfileRow,
                    }));
                  }
                });
            }
          } else if (payload.eventType === "UPDATE" && row) {
            setConnections((prev) =>
              prev.map((c) => (c.id === row.id ? row : c)),
            );
          } else if (payload.eventType === "DELETE" && old) {
            setConnections((prev) => prev.filter((c) => c.id !== old.id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [me]);

  const myInterests = useMemo(
    () => new Set((me?.interest_tags ?? []).map((t) => t.toLowerCase())),
    [me],
  );

  const acceptedConnections = useMemo(
    () => connections.filter((c) => c.status === "accepted"),
    [connections],
  );

  const receivedPending = useMemo(
    () =>
      connections.filter(
        (c) => c.status === "pending" && c.addressee_id === me?.id,
      ),
    [connections, me],
  );

  const sentPending = useMemo(
    () =>
      connections.filter(
        (c) => c.status === "pending" && c.requester_id === me?.id,
      ),
    [connections, me],
  );

  const otherProfile = (conn: ConnectionRow) => {
    if (!me) return undefined;
    const otherId =
      conn.requester_id === me.id ? conn.addressee_id : conn.requester_id;
    return profiles[otherId];
  };

  const sharedCountWith = (profile: ProfileRow | undefined) => {
    if (!profile) return 0;
    return profile.interest_tags.filter((t) =>
      myInterests.has(t.toLowerCase()),
    ).length;
  };

  const handleAccept = async (conn: ConnectionRow) => {
    setBusyId(conn.id);
    const { error } = await supabase
      .from("connections")
      .update({ status: "accepted" })
      .eq("id", conn.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConnections((prev) =>
      prev.map((c) => (c.id === conn.id ? { ...c, status: "accepted" } : c)),
    );
    toast.success("Connection accepted");
  };

  const handleDecline = async (conn: ConnectionRow) => {
    setBusyId(conn.id);
    const { error } = await supabase
      .from("connections")
      .update({ status: "declined" })
      .eq("id", conn.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConnections((prev) =>
      prev.map((c) => (c.id === conn.id ? { ...c, status: "declined" } : c)),
    );
    toast.success("Request declined");
  };

  const handleWithdraw = async (conn: ConnectionRow) => {
    setBusyId(conn.id);
    const { error } = await supabase.from("connections").delete().eq("id", conn.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConnections((prev) => prev.filter((c) => c.id !== conn.id));
    toast.success("Request withdrawn");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const requestBadgeCount = receivedPending.length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="font-serif text-4xl text-foreground">
              Introductions
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your neighbors and pending introductions.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/discover">
              <UserPlus className="mr-2 h-4 w-4" /> Community Match
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Tabs */}
        <div className="mb-6 flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("neighbors")}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition",
              activeTab === "neighbors"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Neighbors
            </span>
            {activeTab === "neighbors" && (
              <span className="absolute bottom-0 left-0 h-0.5 w-full bg-primary" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition",
              activeTab === "requests"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Requests
              {requestBadgeCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {requestBadgeCount}
                </span>
              )}
            </span>
            {activeTab === "requests" && (
              <span className="absolute bottom-0 left-0 h-0.5 w-full bg-primary" />
            )}
          </button>
        </div>

        {activeTab === "neighbors" && (
          <div>
            {acceptedConnections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No introductions yet. Visit Community Match to meet neighbors.
                </p>
                <div className="mt-4">
                  <Button asChild>
                    <Link to="/discover">Open Community Match</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {acceptedConnections.map((conn) => {
                  const peer = otherProfile(conn);
                  const shared = sharedCountWith(peer);
                  return (
                    <div
                      key={conn.id}
                      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20 text-base font-semibold text-foreground">
                        {initialsFor(peer?.first_name ?? "", peer?.last_name ?? null)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground">
                          {displayName(peer?.first_name ?? "", peer?.last_name ?? null)}
                        </h3>
                        {peer?.job_title && (
                          <p className="text-xs text-muted-foreground">
                            {peer.job_title}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {shared > 0 ? `${shared} shared interest${shared !== 1 ? "s" : ""}` : ""}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/messages/${conn.id}`}>
                          <MessageSquare className="mr-1.5 h-4 w-4" />
                          Message
                        </a>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "requests" && (
          <div className="space-y-8">
            {/* Received */}
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Received
              </h2>
              {receivedPending.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending requests.
                </p>
              ) : (
                <div className="space-y-3">
                  {receivedPending.map((conn) => {
                    const peer = otherProfile(conn);
                    return (
                      <div
                        key={conn.id}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20 text-base font-semibold text-foreground">
                            {initialsFor(peer?.first_name ?? "", peer?.last_name ?? null)}
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">
                              {displayName(peer?.first_name ?? "", peer?.last_name ?? null)}
                            </h3>
                            {peer?.job_title && (
                              <p className="text-xs text-muted-foreground">
                                {peer.job_title}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 sm:ml-auto">
                          <Button
                            size="sm"
                            disabled={busyId === conn.id}
                            onClick={() => handleAccept(conn)}
                          >
                            {busyId === conn.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Accept"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === conn.id}
                            onClick={() => handleDecline(conn)}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sent */}
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Sent
              </h2>
              {sentPending.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending sent requests.
                </p>
              ) : (
                <div className="space-y-3">
                  {sentPending.map((conn) => {
                    const peer = otherProfile(conn);
                    return (
                      <div
                        key={conn.id}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20 text-base font-semibold text-foreground">
                            {initialsFor(peer?.first_name ?? "", peer?.last_name ?? null)}
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">
                              {displayName(peer?.first_name ?? "", peer?.last_name ?? null)}
                            </h3>
                            {peer?.job_title && (
                              <p className="text-xs text-muted-foreground">
                                {peer.job_title}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="sm:ml-auto">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === conn.id}
                            onClick={() => handleWithdraw(conn)}
                          >
                            {busyId === conn.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Withdraw"
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
