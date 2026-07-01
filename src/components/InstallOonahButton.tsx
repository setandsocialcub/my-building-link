import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InstallOonahModal } from "@/components/InstallOonahModal";
import { usePwaInstall, trackInstallEvent } from "@/hooks/use-pwa-install";

type Props = {
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "secondary" | "outline" | "ghost";
  label?: string;
  /** When true, hides the button once the app is already installed. */
  hideWhenInstalled?: boolean;
};

export function InstallOonahButton({
  className,
  size = "default",
  variant = "default",
  label = "Install OONAH",
  hideWhenInstalled = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const { isInstalled } = usePwaInstall();

  if (hideWhenInstalled && isInstalled) return null;

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={cn("rounded-xl gap-2", className)}
        onClick={() => {
          trackInstallEvent("install_button_click", { source: "button" });
          setOpen(true);
        }}
      >
        <Download className="h-4 w-4" />
        {label}
      </Button>
      <InstallOonahModal open={open} onOpenChange={setOpen} />
    </>
  );
}
