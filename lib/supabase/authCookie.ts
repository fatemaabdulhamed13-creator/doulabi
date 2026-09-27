// @supabase/ssr names the session cookie `sb-<project-ref>-auth-token`
// (large tokens get chunked into `-auth-token.0`, `-auth-token.1`, ...).
// Derive the ref from the project URL instead of hardcoding it so this
// still works if the project ever changes.
const SUPABASE_PROJECT_REF = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  } catch {
    return undefined;
  }
})();

/**
 * Anonymous visitors never carry a Supabase session cookie, so any auth
 * lookup for them is wasted work. Fails open (returns true) if the project
 * ref can't be determined, so a logged-in user is never treated as anonymous.
 */
export function hasSupabaseAuthCookie(cookieNames: Iterable<string>): boolean {
  if (!SUPABASE_PROJECT_REF) return true;
  const prefix = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
  for (const name of cookieNames) if (name.startsWith(prefix)) return true;
  return false;
}
