export function sameOrigin(request: Request): boolean {
  try {
    const header = request.headers.get("origin");
    if (!header) return false;
    const expected = new URL(process.env.SHL_PUBLIC_ORIGIN || request.url);
    if (expected.protocol !== "https:" &&
        !(expected.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(expected.hostname))) return false;
    return new URL(header).origin === expected.origin;
  } catch {
    return false;
  }
}
