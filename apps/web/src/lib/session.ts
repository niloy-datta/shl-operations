export function sameOrigin(request: Request): boolean {
  try {
    const header = request.headers.get("origin");
    if (!header) return false;
    // Reverse proxies may rewrite request.url to an internal origin.
    // An explicit, operator-controlled public origin prevents accepting a
    // spoofed Host or X-Forwarded-Host header as a CSRF authority.
    const expected = new URL(process.env.SHL_PUBLIC_ORIGIN || request.url);
    if (expected.protocol !== "https:" &&
        !(expected.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(expected.hostname))) return false;
    return new URL(header).origin === expected.origin;
  } catch {
    return false;
  }
}
