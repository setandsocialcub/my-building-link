import { Link } from "@tanstack/react-router";

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`mt-12 border-t border-border/60 pt-6 pb-8 text-center text-xs text-muted-foreground ${className}`}
    >
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link to="/privacy" className="hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/terms" className="hover:text-foreground transition-colors">
          Terms of Use
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/community-standards" className="hover:text-foreground transition-colors">
          Community Standards
        </Link>
      </nav>
      <p className="mt-3">© {new Date().getFullYear()} Residence</p>
    </footer>
  );
}
