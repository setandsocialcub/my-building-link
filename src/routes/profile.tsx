import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ResidentPageShell } from "@/components/ResidentPageShell";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

type Profile = {
  id: string;
  user_id: string;
  building_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  interest_tags: string[] | null;
  is_visible: boolean | null;
};

function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }
      setEmail(auth.user.email ?? "");

      const { data } = await supabase
        .from("resident_profiles")
        .select("id, user_id, building_id, first_name, last_name, job_title, interest_tags, is_visible")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const p = data as Profile;
        setProfile(p);
        setFirstName(p.first_name ?? "");
        setLastName(p.last_name ?? "");
        setJobTitle(p.job_title ?? "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const save = async () => {
    if (!profile) return;
    if (!firstName.trim()) {
      toast.error("First name is required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("resident_profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        job_title: jobTitle.trim() || null,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <ResidentPageShell title="Profile" subtitle="Manage your resident details">
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !profile ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <UserIcon className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No resident profile yet. Join a building to get started.
            </p>
            <Button onClick={() => navigate({ to: "/resident-access" })}>
              Join a building
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-2xl space-y-6">
          <div>
            <h1 className="font-serif text-3xl">Your profile</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Signed in as {email}
            </p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={60}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={60}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="job-title">Title / what you do</Label>
                <Input
                  id="job-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Designer, Investor, Parent"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={signOut} className="gap-2">
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ResidentPageShell>
  );
}
