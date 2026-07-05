import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  LogOut,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ResidentPageShell } from "@/components/ResidentPageShell";
import { PrivacyLevelPicker, PrivacyBadge } from "@/components/PrivacyLevelPicker";
import { TagField } from "@/components/TagField";
import { type PrivacyLevel, privacyOption } from "@/lib/privacy";
import { fetchLegalDocument, type LegalDocument } from "@/lib/legal";
import {
  deleteResidentMedia,
  signResidentMedia,
  uploadResidentMedia,
} from "@/lib/resident-media";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

type SocialLinks = {
  website?: string;
  linkedin?: string;
  instagram?: string;
  twitter?: string;
};

type Profile = {
  id: string;
  user_id: string;
  building_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  languages: string[];
  interest_tags: string[];
  professional_skills: string[];
  favorite_local_spots: string[];
  pets: string[];
  social_links: SocialLinks;
  avatar_path: string | null;
  cover_path: string | null;
  is_visible: boolean | null;
  privacy_level: PrivacyLevel;
  accepted_terms_at: string | null;
  accepted_privacy_at: string | null;
  accepted_terms_version: number | null;
  accepted_privacy_version: number | null;
};

const JOB_SUGGESTIONS = [
  "Chef","Designer","Lawyer","Doctor","Photographer","Architect",
  "Teacher","Artist","Engineer","Entrepreneur","Fitness Coach",
];
const LANGUAGE_SUGGESTIONS = ["English","Spanish","French","Portuguese","Italian","Mandarin","Arabic","Hebrew"];
const INTEREST_SUGGESTIONS = ["Wine","Running","Yoga","Books","Cinema","Travel","Cooking","Design","Tech"];
const SKILL_SUGGESTIONS = ["Product","Marketing","Finance","Legal","Coding","Real Estate","Sales","Operations"];

function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [spots, setSpots] = useState<string[]>([]);
  const [pets, setPets] = useState<string[]>([]);
  const [social, setSocial] = useState<SocialLinks>({});

  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>("public");
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [currentTerms, setCurrentTerms] = useState<LegalDocument | null>(null);
  const [currentPrivacy, setCurrentPrivacy] = useState<LegalDocument | null>(null);
  const [reaccepting, setReaccepting] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

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
        .select(
          "id, user_id, building_id, first_name, last_name, job_title, company, bio, languages, interest_tags, professional_skills, favorite_local_spots, pets, social_links, avatar_path, cover_path, is_visible, privacy_level, accepted_terms_at, accepted_privacy_at, accepted_terms_version, accepted_privacy_version",
        )
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const p = data as Profile;
        setProfile(p);
        setFirstName(p.first_name ?? "");
        setLastName(p.last_name ?? "");
        setJobTitle(p.job_title ?? "");
        setCompany(p.company ?? "");
        setBio(p.bio ?? "");
        setLanguages(p.languages ?? []);
        setInterests(p.interest_tags ?? []);
        setSkills(p.professional_skills ?? []);
        setSpots(p.favorite_local_spots ?? []);
        setPets(p.pets ?? []);
        setSocial((p.social_links ?? {}) as SocialLinks);
        setAvatarPath(p.avatar_path ?? null);
        setCoverPath(p.cover_path ?? null);
        setPrivacyLevel(p.privacy_level ?? "public");

        const [av, cv] = await Promise.all([
          signResidentMedia(p.avatar_path),
          signResidentMedia(p.cover_path),
        ]);
        if (!cancelled) {
          setAvatarUrl(av);
          setCoverUrl(cv);
        }
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

  const onPickFile = async (kind: "avatar" | "cover", file: File | null) => {
    if (!file || !profile) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8 MB.");
      return;
    }
    setUploading(kind);
    try {
      const path = await uploadResidentMedia(profile.user_id, kind, file);
      const previousPath = kind === "avatar" ? avatarPath : coverPath;
      const { error } = await (supabase as any)
        .from("resident_profiles")
        .update(kind === "avatar" ? { avatar_path: path } : { cover_path: path })
        .eq("id", profile.id);
      if (error) throw error;
      if (previousPath && previousPath !== path) {
        await deleteResidentMedia(previousPath).catch(() => {});
      }
      const url = await signResidentMedia(path);
      if (kind === "avatar") {
        setAvatarPath(path);
        setAvatarUrl(url);
      } else {
        setCoverPath(path);
        setCoverUrl(url);
      }
      toast.success(kind === "avatar" ? "Photo updated" : "Cover updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!profile) return;
    if (!firstName.trim()) {
      toast.error("First name is required.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("resident_profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        job_title: jobTitle.trim() || null,
        company: company.trim() || null,
        bio: bio.trim() || null,
        languages,
        interest_tags: interests,
        professional_skills: skills,
        favorite_local_spots: spots,
        pets,
        social_links: pruneSocial(social),
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
    setSigningOut(true);
    await supabase.auth.signOut();
    toast.success("Signed out");
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
            <Button onClick={() => navigate({ to: "/resident-access" })}>Join a building</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-3xl space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-3xl">Your profile</h1>
              <p className="text-sm text-muted-foreground mt-1">Signed in as {email}</p>
            </div>
            <div className="flex items-center gap-2">
              <PrivacyBadge level={privacyLevel} />
              <Button
                variant="destructive"
                size="sm"
                onClick={signOut}
                disabled={signingOut}
                className="gap-1.5"
              >
                {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Sign out
              </Button>
            </div>
          </div>

          {/* Cover + avatar */}
          <Card className="overflow-hidden">
            <div className="relative">
              <div className="h-40 sm:h-52 bg-gradient-to-br from-primary/15 via-primary/5 to-muted relative">
                {coverUrl && (
                  <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => coverInput.current?.click()}
                  disabled={uploading !== null}
                  className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur px-3 py-1.5 text-xs font-medium border border-border hover:bg-background transition-colors"
                >
                  {uploading === "cover" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                  {coverUrl ? "Change cover" : "Add cover"}
                </button>
                <input
                  ref={coverInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile("cover", e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="px-6 pb-6 -mt-10">
                <div className="relative inline-block">
                  <div className="h-20 w-20 rounded-full ring-4 ring-card bg-muted overflow-hidden grid place-items-center text-muted-foreground">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserIcon className="h-7 w-7" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInput.current?.click()}
                    disabled={uploading !== null}
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground grid place-items-center shadow ring-2 ring-card"
                    aria-label="Upload photo"
                  >
                    {uploading === "avatar" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickFile("avatar", e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Basics */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name">First name</Label>
                  <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="job-title">What do you do? <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <p className="text-xs text-muted-foreground -mt-0.5">
                  Help your neighbors discover shared interests and professional expertise.
                </p>
                <Input
                  id="job-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Chef, Designer, Lawyer, Photographer…"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {JOB_SUGGESTIONS.filter((s) => s.toLowerCase() !== jobTitle.trim().toLowerCase()).slice(0, 8).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setJobTitle(s)}
                      className="text-[11px] rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company">Company <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} placeholder="Where you work" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={4} placeholder="A short intro your neighbors will see." />
                <div className="text-[11px] text-muted-foreground text-right">{bio.length}/500</div>
              </div>
            </CardContent>
          </Card>

          {/* Interests & Skills */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <TagField
                id="languages"
                label="Languages"
                value={languages}
                onChange={setLanguages}
                placeholder="Type a language and press enter"
                suggestions={LANGUAGE_SUGGESTIONS}
              />
              <TagField
                id="interests"
                label="Interests"
                value={interests}
                onChange={setInterests}
                placeholder="What are you into?"
                suggestions={INTEREST_SUGGESTIONS}
              />
              <TagField
                id="skills"
                label="Professional skills"
                hint="Neighbors can search these when they need help."
                value={skills}
                onChange={setSkills}
                placeholder="e.g. Interior design, Tax law…"
                suggestions={SKILL_SUGGESTIONS}
              />
              <TagField
                id="spots"
                label="Favorite local spots"
                hint="Cafés, restaurants, parks, shops nearby you love."
                value={spots}
                onChange={setSpots}
                placeholder="e.g. Blue Bottle on 5th"
              />
              <TagField
                id="pets"
                label="Pets"
                value={pets}
                onChange={setPets}
                placeholder="e.g. Luna (Golden retriever)"
              />
            </CardContent>
          </Card>

          {/* Social links */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold">Social links <span className="text-muted-foreground text-xs font-normal">(Optional)</span></h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Only shared with neighbors who can see your full profile.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["website","linkedin","instagram","twitter"] as const).map((key) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`social-${key}`} className="capitalize">{key === "twitter" ? "X / Twitter" : key}</Label>
                    <Input
                      id={`social-${key}`}
                      value={social[key] ?? ""}
                      onChange={(e) => setSocial((s) => ({ ...s, [key]: e.target.value }))}
                      placeholder={key === "website" ? "https://…" : "@handle or URL"}
                      maxLength={200}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
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
                {savingPrivacy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <PrivacyLevelPicker value={privacyLevel} onChange={updatePrivacy} disabled={savingPrivacy} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-semibold">Legal Acceptance</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Documents you have agreed to and when you accepted them.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {(["terms","privacy"] as const).map((type) => {
                  const doc = type === "terms" ? currentTerms : currentPrivacy;
                  const at = type === "terms" ? profile.accepted_terms_at : profile.accepted_privacy_at;
                  const version = type === "terms" ? profile.accepted_terms_version : profile.accepted_privacy_version;
                  const label = type === "terms" ? "Terms of Use" : "Privacy Policy";
                  const stale = doc && version != null && version < doc.version;
                  return (
                    <div key={type} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{label}</span>
                        {at ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Accepted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> Not accepted
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {at ? (
                          <>
                            <p>
                              Accepted on{" "}
                              {new Date(at).toLocaleDateString(undefined, {
                                year: "numeric", month: "long", day: "numeric",
                              })}
                            </p>
                            {typeof version === "number" && <p>Version {version}</p>}
                          </>
                        ) : (
                          <p>You have not yet accepted the {label}.</p>
                        )}
                        {stale && (
                          <div className="flex items-center gap-2 pt-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span className="text-amber-700">A newer version is available (v{doc!.version}).</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs ml-auto"
                              disabled={reaccepting === type}
                              onClick={() => reaccept(type)}
                            >
                              {reaccepting === type && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              Accept latest
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-semibold">Legal &amp; Policies</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Review the documents that govern your account.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <Link to="/privacy" className="rounded-lg border border-border px-3 py-2 text-sm text-center hover:bg-muted transition-colors">Privacy Policy</Link>
                <Link to="/terms" className="rounded-lg border border-border px-3 py-2 text-sm text-center hover:bg-muted transition-colors">Terms of Use</Link>
                <Link to="/community-standards" className="rounded-lg border border-border px-3 py-2 text-sm text-center hover:bg-muted transition-colors">Community Standards</Link>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button
              variant="destructive"
              onClick={signOut}
              disabled={signingOut}
              className="gap-1.5"
            >
              {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sign out
            </Button>
          </div>
        </div>
      )}
    </ResidentPageShell>
  );
}

function pruneSocial(s: SocialLinks): SocialLinks {
  const out: SocialLinks = {};
  (Object.keys(s) as (keyof SocialLinks)[]).forEach((k) => {
    const v = (s[k] ?? "").trim();
    if (v) out[k] = v;
  });
  return out;
}
