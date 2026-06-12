import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ResidentPageShell } from "@/components/ResidentPageShell";
import { FeatureGate } from "@/components/FeatureGate";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ImagePlus, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useBranding } from "@/components/BrandingProvider";
import { brandingValue } from "@/lib/branding";
import { BrandedSectionIntro } from "@/components/BrandedSectionIntro";

export const Route = createFileRoute("/marketplace")({
  component: () => (
    <FeatureGate feature="enable_resident_exchange" featureLabel="Resident Exchange">
      <MarketplacePage />
    </FeatureGate>
  ),
});

type Listing = {
  id: string;
  building_id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  is_free: boolean;
  image_url: string | null;
  status: string;
  created_at: string;
  seller?: { first_name: string | null; last_name: string | null } | null;
};

type MyProfile = { id: string; building_id: string };

type FilterTab = "all" | "sale" | "free" | "sold";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function sellerName(s: { first_name: string | null; last_name: string | null } | null | undefined) {
  if (!s || !s.first_name) return "Resident";
  const li = s.last_name?.trim()?.[0];
  return li ? `${s.first_name} ${li}.` : s.first_name;
}

function MarketplacePage() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const community = brandingValue(branding, "community_name");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterTab>("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [openDetail, setOpenDetail] = useState<Listing | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate({ to: "/resident-access" });
        return;
      }
      const { data: profiles } = await supabase
        .from("resident_profiles")
        .select("id, building_id")
        .eq("user_id", auth.user.id)
        .limit(1);
      if (!profiles?.length) {
        toast.error("Join a building first.");
        navigate({ to: "/resident-access" });
        return;
      }
      if (cancelled) return;
      setMe(profiles[0] as MyProfile);
      await loadListings(profiles[0].building_id);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadListings(buildingId: string) {
    const { data, error } = await supabase
      .from("marketplace_listings")
      .select(
        "id, building_id, seller_id, title, description, price, is_free, image_url, status, created_at, seller:resident_profiles!seller_id(first_name, last_name)",
      )
      .eq("building_id", buildingId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = (data ?? []) as unknown as Listing[];
    setListings(rows);

    const paths = rows
      .map((r) => r.image_url)
      .filter((p): p is string => !!p);
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("marketplace")
        .createSignedUrls(paths, 60 * 60);
      if (signed) {
        const map: Record<string, string> = {};
        signed.forEach((s) => {
          if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
        });
        setSignedUrls(map);
      }
    }
  }

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (filter === "all") return true;
      if (filter === "sold") return l.status === "sold";
      if (filter === "free") return l.is_free && l.status !== "sold";
      if (filter === "sale") return !l.is_free && l.status !== "sold";
      return true;
    });
  }, [listings, filter]);

  return (
    <ResidentPageShell title="Resident Exchange" subtitle={`Pass along inside ${community}`}>
      {loading ? (
        <div className="grid place-items-center min-h-[40vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="max-w-5xl">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-serif text-3xl tracking-tight flex items-center gap-3">
                <ShoppingBag className="h-7 w-7" /> Resident Exchange
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Pass along, pick up, and pay it forward inside {community}.
              </p>
            </div>
            <Button onClick={() => setOpenCreate(true)}>List an Item</Button>
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sale">For Sale</TabsTrigger>
              <TabsTrigger value="free">Free</TabsTrigger>
              <TabsTrigger value="sold">Sold</TabsTrigger>
            </TabsList>
          </Tabs>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No listings yet. Be the first to post!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  imgSrc={l.image_url ? signedUrls[l.image_url] : undefined}
                  onClick={() => setOpenDetail(l)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {me && (
        <CreateListingDialog
          open={openCreate}
          onOpenChange={setOpenCreate}
          me={me}
          onCreated={() => loadListings(me.building_id)}
        />
      )}

      <DetailDialog
        listing={openDetail}
        imgSrc={openDetail?.image_url ? signedUrls[openDetail.image_url] : undefined}
        myProfileId={me?.id ?? null}
        onClose={() => setOpenDetail(null)}
        onChanged={() => me && loadListings(me.building_id)}
      />
    </ResidentPageShell>
  );
}

function ListingCard({
  listing,
  imgSrc,
  onClick,
}: {
  listing: Listing;
  imgSrc?: string;
  onClick: () => void;
}) {
  const sold = listing.status === "sold";
  return (
    <button
      onClick={onClick}
      className="text-left group rounded-xl overflow-hidden border bg-card hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-muted">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={listing.title}
            className={cn("h-full w-full object-cover", sold && "opacity-50")}
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-5xl">
            🛍️
          </div>
        )}
        {sold && (
          <div className="absolute inset-0 grid place-items-center">
            <Badge className="text-base px-3 py-1">Sold</Badge>
          </div>
        )}
        {listing.is_free && !sold && (
          <Badge className="absolute top-2 left-2 bg-accent text-accent-foreground">
            Free
          </Badge>
        )}
      </div>
      <div className="p-3">
        <div className="font-medium line-clamp-1">{listing.title}</div>
        <div className="text-lg font-semibold mt-0.5">
          {listing.is_free ? (
            <span className="text-accent-foreground">Free</span>
          ) : (
            `$${Number(listing.price).toFixed(2)}`
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
          <span>{sellerName(listing.seller)}</span>
          <span>{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </button>
  );
}

function CreateListingDialog({
  open,
  onOpenChange,
  me,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  me: MyProfile;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setPrice("");
    setIsFree(false);
    setFile(null);
    setPreview(null);
  }

  function handleFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (title.length > 80) {
      toast.error("Title must be 80 characters or fewer.");
      return;
    }
    if (description.length > 500) {
      toast.error("Description must be 500 characters or fewer.");
      return;
    }
    const priceNum = isFree ? 0 : Number(price || 0);
    if (!isFree && (!Number.isFinite(priceNum) || priceNum < 0)) {
      toast.error("Enter a valid price or mark it as free.");
      return;
    }

    setSubmitting(true);
    try {
      let image_url: string | null = null;
      if (file) {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) throw new Error("Not signed in");
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("marketplace")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        image_url = path;
      }

      const { error } = await supabase.from("marketplace_listings").insert({
        building_id: me.building_id,
        seller_id: me.id,
        title: title.trim(),
        description: description.trim() || null,
        price: priceNum,
        is_free: isFree,
        image_url,
      });
      if (error) throw error;

      toast.success("Your listing is live!");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create listing.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>List an item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Title</Label>
            <Input
              id="m-title"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you selling?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Description</Label>
            <Textarea
              id="m-desc"
              value={description}
              maxLength={500}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details, condition, pickup info…"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium text-sm">This is free</div>
              <div className="text-xs text-muted-foreground">Give it away to a neighbor</div>
            </div>
            <Switch
              checked={isFree}
              onCheckedChange={(v) => {
                setIsFree(v);
                if (v) setPrice("");
              }}
            />
          </div>

          {!isFree && (
            <div className="space-y-1.5">
              <Label htmlFor="m-price">Price (USD)</Label>
              <Input
                id="m-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Photo (optional)</Label>
            {preview ? (
              <div className="relative">
                <img src={preview} alt="preview" className="rounded-lg w-full aspect-square object-cover" />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => handleFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 border border-dashed rounded-lg py-6 cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground">
                <ImagePlus className="h-4 w-4" />
                Upload an image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Post listing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({
  listing,
  imgSrc,
  myProfileId,
  onClose,
  onChanged,
}: {
  listing: Listing | null;
  imgSrc?: string;
  myProfileId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!listing) return null;
  const isMine = myProfileId === listing.seller_id;
  const sold = listing.status === "sold";

  async function toggleSold() {
    if (!listing) return;
    setBusy(true);
    const { error } = await supabase
      .from("marketplace_listings")
      .update({ status: sold ? "available" : "sold" })
      .eq("id", listing.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(sold ? "Marked available" : "Marked as sold");
    onClose();
    onChanged();
  }

  async function removeListing() {
    if (!listing) return;
    if (!confirm("Delete this listing?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("marketplace_listings")
      .delete()
      .eq("id", listing.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Listing removed");
    onClose();
    onChanged();
  }

  return (
    <Dialog open={!!listing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{listing.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden bg-muted aspect-square">
            {imgSrc ? (
              <img src={imgSrc} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-6xl">🛍️</div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-semibold">
              {listing.is_free ? "Free" : `$${Number(listing.price).toFixed(2)}`}
            </div>
            {sold && <Badge>Sold</Badge>}
          </div>
          {listing.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {listing.description}
            </p>
          )}
          <div className="text-xs text-muted-foreground">
            Posted by {sellerName(listing.seller)} · {timeAgo(listing.created_at)}
          </div>
        </div>
        <DialogFooter>
          {isMine ? (
            <>
              <Button variant="ghost" onClick={removeListing} disabled={busy}>
                Delete
              </Button>
              <Button onClick={toggleSold} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {sold ? "Mark available" : "Mark as sold"}
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
