import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const cookieName = "shl_session";
const duration = 8 * 60 * 60;

function key() {
  const raw = process.env.SESSION_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) throw new Error("SESSION_KEY must be 64 hex characters");
  return Buffer.from(raw, "hex");
}
export function seal(authorization: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = JSON.stringify({ authorization, exp: Date.now() + duration * 1000 });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function unseal(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    return typeof data.exp === "number" && data.exp > Date.now() && typeof data.authorization === "string"
      ? data.authorization : null;
  } catch { return null; }
}
export async function sessionAuthorization() {
  return unseal((await cookies()).get(cookieName)?.value);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return !!origin && !!host && new URL(origin).host === host;
}

