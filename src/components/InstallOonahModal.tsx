import { useEffect, useState } from "react";
import {
  Download,
  Share,
  MoreVertical,
  Plus,
  Zap,
  Maximize2,
  Users,
  Home,
  Bell,
  Check,
  Sparkles,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePwaInstall, trackInstallEvent, type InstallPlatform } from "@/hooks/use-pwa-install";

const BENEFITS = [
  { icon: Zap, label: "Faster access" },
  { icon: Maximize2, label: "Full-screen experience" },
  { icon: Users, label: "Stay connected to your community" },
  { icon: Home, label: "Quick access from home screen or desktop" },
  { icon: Bell, label: "Future-ready for notifications and community updates" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InstallOonahModal({ open, onOpenChange }: Props) {
  const { canPrompt, platform, isInstalled, justInstalled, promptInstall, dismissJustInstalled } =
    usePwaInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (open) trackInstallEvent("install_modal_opened", { platform });
  }, [open, platform]);

  useEffect(() => {
    if (!open) setShowInstructions(false);
  }, [open]);

  // Welcome / just-installed state takes over the modal
  if (justInstalled) {
    return (
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) dismissJustInstalled();
          onOpenChange(v);
        }}
      >
        <DialogContent className="sm:max-w-md overflow-hidden border-white/10 bg-gradient-to-b from-card/95 to-card backdrop-blur-xl">
          <div className="flex flex-col items-center text-center py-6">
            <div className="h-14 w-14 rounded-full bg-primary/15 text-primary grid place-items-center mb-4 animate-scale-in">
              <Check className="h-7 w-7" />
            </div>
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              Welcome to OONAH
            </DialogTitle>
            <DialogDescription className="mt-2 text-muted-foreground">
              You're now connected to your community.
            </DialogDescription>
            <Button
              className="mt-6 w-full h-11 rounded-xl"
              onClick={() => {
                dismissJustInstalled();
                onOpenChange(false);
              }}
            >
              Open OONAH
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleInstall = async () => {
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome !== "unavailable") {
        onOpenChange(false);
      }
    } else {
      trackInstallEvent("install_instructions_shown", { platform });
      setShowInstructions(true);
    }
  };

  const handleClose = () => {
    trackInstallEvent("install_modal_dismissed", { platform });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
        else onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md overflow-hidden border-white/10 bg-gradient-to-b from-card/95 to-card backdrop-blur-xl">
        {/* Decorative glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
        />

        <DialogHeader className="relative">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary grid place-items-center ring-1 ring-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Install OONAH
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm">
                Enjoy OONAH like a native app.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isInstalled ? (
          <div className="relative mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
            OONAH is already installed on this device. You can launch it from your home screen or
            app menu.
          </div>
        ) : showInstructions ? (
          <InstallInstructions platform={platform} />
        ) : (
          <ul className="relative mt-4 space-y-2.5">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-secondary/40 text-foreground/80 grid place-items-center ring-1 ring-border">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-foreground/90 leading-relaxed">{label}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="relative mt-6 flex flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="ghost"
            className="sm:flex-1 h-11 rounded-xl"
            onClick={handleClose}
          >
            Maybe Later
          </Button>
          {!isInstalled && !showInstructions && (
            <Button className="sm:flex-1 h-11 rounded-xl gap-2" onClick={handleInstall}>
              <Download className="h-4 w-4" />
              Install Now
            </Button>
          )}
          {showInstructions && (
            <Button
              variant="secondary"
              className="sm:flex-1 h-11 rounded-xl"
              onClick={() => setShowInstructions(false)}
            >
              Back
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InstallInstructions({ platform }: { platform: InstallPlatform }) {
  const steps = INSTRUCTIONS[platform] ?? INSTRUCTIONS.other;
  return (
    <div className="relative mt-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {steps.heading}
      </p>
      <ol className="mt-3 space-y-3">
        {steps.items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold ring-1 ring-primary/20">
              {i + 1}
            </div>
            <div className="text-sm text-foreground/90 leading-relaxed flex items-center gap-1.5 flex-wrap">
              {it}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const INSTRUCTIONS: Record<
  InstallPlatform,
  { heading: string; items: React.ReactNode[] }
> = {
  ios: {
    heading: "iPhone / iPad — Safari",
    items: [
      <>
        Tap the <Share className="inline h-4 w-4 mx-0.5 align-text-bottom" /> Share button.
      </>,
      <>Select "Add to Home Screen."</>,
      <>Tap Add — OONAH appears on your home screen.</>,
    ],
  },
  android: {
    heading: "Android — Chrome",
    items: [
      <>
        Tap the <MoreVertical className="inline h-4 w-4 mx-0.5 align-text-bottom" /> menu.
      </>,
      <>Choose "Install app" or "Add to Home screen."</>,
      <>Tap Install to confirm.</>,
    ],
  },
  "desktop-chrome": {
    heading: "Chrome — Desktop",
    items: [
      <>
        Click the <Download className="inline h-4 w-4 mx-0.5 align-text-bottom" /> install icon on
        the right of the address bar.
      </>,
      <>Or open the ⋮ menu → "Install OONAH…"</>,
      <>Confirm to add OONAH to your desktop.</>,
    ],
  },
  "desktop-edge": {
    heading: "Microsoft Edge — Desktop",
    items: [
      <>
        Click the <Plus className="inline h-4 w-4 mx-0.5 align-text-bottom" /> install icon in the
        address bar.
      </>,
      <>Or open the ⋯ menu → Apps → "Install this site as an app."</>,
      <>Confirm to add OONAH.</>,
    ],
  },
  "desktop-safari": {
    heading: "Safari — Mac",
    items: [
      <>Open the File menu.</>,
      <>Choose "Add to Dock…"</>,
      <>Confirm — OONAH is added to your Dock.</>,
    ],
  },
  "desktop-firefox": {
    heading: "Firefox",
    items: [
      <>Firefox doesn't fully support installing web apps yet.</>,
      <>For the best experience, open OONAH in Chrome, Edge, or Safari.</>,
    ],
  },
  "desktop-other": {
    heading: "Desktop browser",
    items: [
      <>Look for an install icon in the address bar.</>,
      <>Or check your browser's menu for "Install app."</>,
    ],
  },
  other: {
    heading: "Install OONAH",
    items: [
      <>Open OONAH in Chrome, Edge, or Safari.</>,
      <>Use your browser's menu to add OONAH to your home screen.</>,
    ],
  },
};
