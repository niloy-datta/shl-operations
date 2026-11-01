export function canAccessWorkspace(email?: string | null) {
  const allowed = (process.env.SHL_AUTH_ALLOWED_EMAILS || "").split(",")
    .map(value => value.trim().toLowerCase()).filter(Boolean);
  // Fail closed until the owner/staff email allowlist is configured.
  return Boolean(email && allowed.includes(email.toLowerCase()));
}
