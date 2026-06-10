import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Loader2, LogOut, ShieldCheck, User as UserIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ResidentPageShell } from "@/components/ResidentPageShell";
import { PrivacyLevelPicker, PrivacyBadge } from "@/components/PrivacyLevelPicker";
import { type PrivacyLevel, privacyOption } from "@/lib/privacy";
import { fetchLegalDocument, type LegalDocument } from "@/lib/legal";

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
  privacy_level: PrivacyLevel;
  accepted_terms_at: string | null;
  accepted_privacy_at: string | null;
  accepted_terms_version: number | null;
  accepted_privacy_version: number | null;
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
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>("public");
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [currentTerms, setCurrentTerms] = useState<LegalDocument | null>(null);
  const [currentPrivacy, setCurrentPrivacy] = useState<LegalDocument | null>(null);
  const [reaccepting, setReaccepting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }
      setEmail(auth.user.email ?? "");

      const { data } = await (supabase as any)
        .from("resident_profiles")
        .select("id, user_id, building_id, first_name, last_name, job_title, interest_tags, is_visible, privacy_level, accepted_terms_at, accepted_privacy_at, accepted_terms_version, accepted_privacy_version")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const p = data as Profile;
        setProfile(p);
        setFirstName(p.first_name ?? "");
        setLastName(p.last_name ?? "");
        setJobTitle(p.job_title ?? "");
        setPrivacyLevel(p.privacy_level ?? "public");
      }

      const [termsDoc, privacyDoc] = await Promise.all([
        fetchLegalDocument("terms"),
        fetchLegalDocument("privacy"),
      ]);
      if (!cancelled) {
        setCurrentTerms(termsDoc);
        setCurrentPrivacy(privacyDoc);
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

  const updatePrivacy = async (next: PrivacyLevel) => {
    if (!profile || next === privacyLevel) return;
    const previous = privacyLevel;
    setPrivacyLevel(next);
    setSavingPrivacy(true);
    const { error } = await supabase
      .from("resident_profiles")
      .update({ privacy_level: next })
      .eq("id", profile.id);
    setSavingPrivacy(false);
    if (error) {
      setPrivacyLevel(previous);
      toast.error(error.message);
      return;
    }
    toast.success(`Privacy set to "${privacyOption(next).title}"`);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("privacy:changed", { detail: { level: next } }));
    }
  };

  const reaccept = async (type: "terms" | "privacy") => {
    if (!profile) return;
    const doc = type === "terms" ? currentTerms : currentPrivacy;
    if (!doc) return;
    setReaccepting(type);
    const update: any = {
      [`accepted_${type}_at`]: new Date().toISOString(),
      [`accepted_${type}_version`]: doc.version,
    };
    const { error } = await supabase.from("resident_profiles").update(update).eq("id", profile.id);
    setReaccepting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProfile((prev) => {
      if (!prev) return prev;
      if (type === "terms") {
        return { ...prev, accepted_terms_at: update.accepted_terms_at as string, accepted_terms_version: doc.version };
      }
      return { ...prev, accepted_privacy_at: update.accepted_privacy_at as string, accepted_privacy_version: doc.version };
    });
    toast.success(`You have accepted the latest ${type === "terms" ? "Terms of Use" : "Privacy Policy"}.`);
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-3xl">Your profile</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Signed in as {email}
              </p>
            </div>
            <PrivacyBadge level={privacyLevel} />
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

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-semibold">Privacy</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You choose what neighbors can see. Managers of your building always see the full profile. Accepted introductions and conversations always unlock full details for that person.
                  </p>
                </div>
                {savingPrivacy && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <PrivacyLevelPicker
                value={privacyLevel}
                onChange={updatePrivacy}
                disabled={savingPrivacy}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-semibold">Legal & Policies</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Review the documents that govern your account.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <Link to="/privacy" className="rounded-lg border border-border px-3 py-2 text-sm text-center hover:bg-muted transition-colors">
                  Privacy Policy
                </Link>
                <Link to="/terms" className="rounded-lg border border-border px-3 py-2 text-sm text-center hover:bg-muted transition-colors">
                  Terms of Use
                </Link>
                <Link to="/community-standards" className="rounded-lg border border-border px-3 py-2 text-sm text-center hover:bg-muted transition-colors">
                  Community Standards
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ResidentPageShell>
  );
}
