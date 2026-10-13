import { cookies } from "next/headers";

export const cookieName = "shl_session";
export const sessionDuration = 8 * 60 * 60;
// 32 secure random bytes encoded as unpadded base64url.
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export async function sessionToken(): Promise<string | null> {
  const token = (await cookies()).get(cookieName)?.value ?? "";
  return tokenPattern.test(token) ? token : null;
}

export async function sessionAuthorization(): Promise<string | null> {
  const token = await sessionToken();
  return token ? `Bearer ${token}` : null;
}

export function sameOrigin(request: Request): boolean {
  try {
    const header = request.headers.get("origin");
    if (!header) return false;
    return new URL(header).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
