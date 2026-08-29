export const IDENTITY_COOKIE = "draftlab-user";

/** Who is signed in, read from the cookie in the browser. Null on the server
 *  and before anyone has chosen a name. */
export function currentIdentity(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${IDENTITY_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
