import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, KeyRound, Shield, ArrowRight } from "lucide-react";
import { LegalFooter } from "@/components/LegalFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Welcome — Choose Your Access" },
      {
        name: "description",
        content:
          "Resident, property manager, or system admin — pick how you'd like to sign in.",
      },
    ],
  }),
  component: LandingChooser,
});

function LandingChooser() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Welcome home
          </h1>
          <p className="mt-3 text-muted-foreground">
            How would you like to continue?
          </p>
        </div>

        <div className="space-y-4">
          <Link
            to="/resident-access"
            className="group block rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-5">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0">
                <KeyRound className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground">
                  Resident Access
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Enter your building's access code to join your community.
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
          </Link>

          <Link
            to="/manager-auth"
            className="group block rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-5">
              <div className="h-12 w-12 rounded-xl bg-muted text-foreground grid place-items-center flex-shrink-0">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground">
                  Property Management Portal
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Sign in or create a manager account to run your building.
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
          </Link>
        </div>

        <div className="mt-16 text-center">
          <Link
            to="/super-admin-login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            System Admin
          </Link>
        </div>
      </div>
    </main>
  );
}
