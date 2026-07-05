/**
 * Translates raw Supabase Auth error messages into user-friendly ones so
 * flows like sign-in, sign-up, password reset, and verification never fail
 * silently.
 */
export type AuthContext = "signin" | "signup" | "reset" | "verify" | "invite";

const MAP: Array<{ match: RegExp; context?: AuthContext[]; message: string }> = [
  {
    match: /invalid login credentials|invalid email or password|invalid_credentials/i,
    context: ["signin"],
    message: "Incorrect email or password. Double-check both and try again.",
  },
  {
    match: /email not confirmed|email_not_confirmed/i,
    message: "Please verify your email first — check your inbox for the confirmation link.",
  },
  {
    match: /user not found|no user found/i,
    message: "This email isn't registered. Create an account or use your invitation code.",
  },
  {
    match: /already registered|user already exists|already been registered/i,
    context: ["signup"],
    message: "An account with this email already exists. Try signing in instead.",
  },
  {
    match: /password.*(short|weak|at least)/i,
    message: "Password is too weak. Use at least 8 characters with a mix of letters and numbers.",
  },
  {
    match: /invalid email|email.*invalid|malformed/i,
    message: "That doesn't look like a valid email address.",
  },
  {
    match: /rate limit|too many requests|over_email_send_rate_limit/i,
    message: "Too many attempts. Please wait a minute and try again.",
  },
  {
    match: /captcha/i,
    message: "Please complete the security check and try again.",
  },
  {
    match: /invite|invitation/i,
    context: ["invite", "signup"],
    message: "An invitation is required for this building. Ask your property manager for an access code.",
  },
  {
    match: /token.*(expired|invalid)|otp.*expired/i,
    message: "This link has expired. Please request a new one.",
  },
  {
    match: /network|failed to fetch|networkerror/i,
    message: "Network error. Check your connection and try again.",
  },
];

export function friendlyAuthError(err: unknown, context: AuthContext = "signin"): string {
  const raw = extractMessage(err);
  if (!raw) return fallback(context);
  for (const entry of MAP) {
    if ((!entry.context || entry.context.includes(context)) && entry.match.test(raw)) {
      return entry.message;
    }
  }
  return raw;
}

export function friendlyAuthSuccess(context: AuthContext): string {
  switch (context) {
    case "signin":
      return "Signed in — welcome back.";
    case "signup":
      return "Account created. Check your email to verify.";
    case "reset":
      return "Password reset link sent — check your inbox.";
    case "verify":
      return "Verification email sent — check your inbox.";
    case "invite":
      return "Invitation accepted.";
    default:
      return "Success.";
  }
}

function extractMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return null;
}

function fallback(context: AuthContext): string {
  switch (context) {
    case "signin":
      return "Sign in failed. Please try again.";
    case "signup":
      return "Couldn't create your account. Please try again.";
    case "reset":
      return "Couldn't send reset email. Please try again.";
    case "verify":
      return "Couldn't send verification email. Please try again.";
    case "invite":
      return "Couldn't accept invitation. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * Basic client-side email + password validators used before hitting Supabase
 * so users get an immediate, specific error instead of a generic API failure.
 */
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Please enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
    return "That doesn't look like a valid email address.";
  if (trimmed.length > 254) return "That email address is too long.";
  return null;
}

export function validatePassword(password: string, context: AuthContext = "signin"): string | null {
  if (!password) {
    return context === "signin" ? "Please enter your password." : "Please choose a password.";
  }
  if (context === "signup" && password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}
