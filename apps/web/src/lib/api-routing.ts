export function resolveBusinessPath(parts: string[]): string | null {
  if (!parts.length || parts.some(part => !/^[A-Za-z0-9_-]{1,80}$/.test(part))) return null;
  const [group, resource, ...rest] = parts;
  if (group === "data" && ["dashboard", "me", "customers", "suppliers"].includes(resource)) {
    if (["dashboard", "me"].includes(resource) && rest.length) return null;
    if (rest.length > 1 || (rest.length === 1 && !/^[0-9a-f-]{36}$/i.test(rest[0]))) return null;
    return "/api/" + [resource, ...rest].join("/");
  }
  if (group === "trading" && resource === "rfqs") return "/api/" + parts.slice(1).join("/");
  if (group === "enterprise" && ["commerce", "logistics", "finance", "staff", "audit", "dedup", "entities", "tasks"].includes(resource)) return "/api/" + parts.slice(1).join("/");
  if (["growth", "costs"].includes(group) && resource) return "/api/" + parts.join("/");
  if (parts.length === 1 && group === "alerts") return "/api/alerts";
  if (parts.length === 1 && group === "command-center") return "/api/command-center/summary";
  if (group === "auth" && resource === "sessions" && rest.length <= 1) return "/api/" + parts.join("/");
  return null;
}

export function backendOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}
