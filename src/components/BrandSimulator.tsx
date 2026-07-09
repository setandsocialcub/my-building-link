import { useMemo, useState } from "react";
import {
  Laptop,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
  UserCircle2,
  Shield,
  Building2,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

type Device = "desktop" | "tablet" | "mobile";
type Role = "resident" | "manager" | "admin";

const DEVICES: Record<
  Device,
  { label: string; width: number; height: number; icon: typeof Monitor }
> = {
  desktop: { label: "Desktop", width: 1440, height: 900, icon: Monitor },
  tablet: { label: "Tablet", width: 820, height: 1180, icon: Tablet },
  mobile: { label: "Mobile", width: 390, height: 844, icon: Smartphone },
};

const ROLES: Record<
  Role,
  { label: string; path: (id: string) => string; icon: typeof UserCircle2; note: string }
> = {
  resident: {
    label: "Resident",
    icon: UserCircle2,
    path: (id) => `/building/${id}`,
    note: "What residents see when they open the branded community app.",
  },
  manager: {
    label: "Manager",
    icon: Building2,
    path: (id) => `/manager/${id}`,
    note: "The on-site property manager workspace for this building.",
  },
  admin: {
    label: "Super Admin",
    icon: Shield,
    path: (id) => `/admin/buildings/${id}`,
    note: "The corporate operator's control surface for this building.",
  },
};

/**
 * BrandSimulator — live cross-device / cross-role preview of the current
 * white-label configuration. Renders the target route inside a scaled
 * iframe framed as a device chrome so operators can validate branding
 * without leaving the Studio.
 */
export function BrandSimulator({
  buildingId,
  role: viewerRole,
}: {
  buildingId: string;
  role: "admin" | "manager";
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [role, setRole] = useState<Role>("resident");
  const [nonce, setNonce] = useState(0);

  const src = useMemo(() => {
    // Cache-bust so branding edits refresh in the preview.
    const path = ROLES[role].path(buildingId);
    return `${path}?__sim=${nonce}`;
  }, [role, buildingId, nonce]);

  const { width, height } = DEVICES[device];

  // Available roles for the current viewer.
  const availableRoles: Role[] =
    viewerRole === "admin"
      ? ["resident", "manager", "admin"]
      : ["resident", "manager"];

  return (
    <Card className="p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-lg flex items-center gap-2">
            <Laptop className="h-4 w-4" /> Live simulator
          </h3>
          <p className="text-sm text-muted-foreground max-w-xl">
            {ROLES[role].note} Changes you save in the Studio appear here on refresh.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setNonce((n) => n + 1)}
          className="gap-1.5"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Role
          </Label>
          <ToggleGroup
            type="single"
            value={role}
            onValueChange={(v) => v && setRole(v as Role)}
            className="justify-start flex-wrap"
          >
            {availableRoles.map((r) => {
              const Icon = ROLES[r].icon;
              return (
                <ToggleGroupItem key={r} value={r} className="gap-1.5">
                  <Icon className="h-3.5 w-3.5" /> {ROLES[r].label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Device
          </Label>
          <div className="flex items-center gap-2 flex-wrap">
            <ToggleGroup
              type="single"
              value={device}
              onValueChange={(v) => v && setDevice(v as Device)}
              className="justify-start flex-wrap"
            >
              {(Object.keys(DEVICES) as Device[]).map((d) => {
                const Icon = DEVICES[d].icon;
                return (
                  <ToggleGroupItem key={d} value={d} className="gap-1.5">
                    <Icon className="h-3.5 w-3.5" /> {DEVICES[d].label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            <a
              href={ROLES[role].path(buildingId)}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4 ml-auto"
            >
              Open in new tab <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      <DeviceFrame device={device} width={width} height={height}>
        <iframe
          key={`${role}-${nonce}`}
          src={src}
          title={`${ROLES[role].label} · ${DEVICES[device].label} preview`}
          className="border-0 bg-background"
          style={{ width, height }}
          loading="lazy"
        />
      </DeviceFrame>

      <p className="text-xs text-muted-foreground">
        Rendering <span className="font-mono">{ROLES[role].path(buildingId)}</span> at
        {" "}
        {width}×{height}. The simulator uses your live session, so authenticated
        views reflect your own permissions.
      </p>
    </Card>
  );
}

/**
 * DeviceFrame — responsive scaling wrapper. Measures the container width
 * and scales the fixed-size iframe with a CSS transform so any device
 * fits the Studio column without horizontal scroll.
 */
function DeviceFrame({
  device,
  width,
  height,
  children,
}: {
  device: Device;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  // Available column widths in the Studio are ~800-1100px. We compute the
  // scale from container width via CSS `min()` on a wrapper max-width, and
  // fall back to a resize observer for accuracy.
  const [scale, setScale] = useState(1);

  const containerRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? width;
      const next = Math.min(1, w / width);
      setScale(next);
    });
    ro.observe(node);
  };

  const framedHeight = height * scale;

  const chrome =
    device === "desktop"
      ? "rounded-lg border-4 border-neutral-800 bg-neutral-800 shadow-2xl"
      : device === "tablet"
      ? "rounded-[28px] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl"
      : "rounded-[36px] border-[12px] border-neutral-900 bg-neutral-900 shadow-2xl";

  return (
    <div ref={containerRef} className="w-full">
      <div
        className={`mx-auto overflow-hidden ${chrome}`}
        style={{ width: width * scale, height: framedHeight }}
      >
        <div
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

