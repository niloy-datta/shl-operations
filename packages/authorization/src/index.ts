/** Observed legacy roles; this list does not implement access parity. */
export const LEGACY_ROLES = ['ADMIN', 'MANAGEMENT', 'BD', 'SOURCING', 'LOGISTICS', 'FINANCE'] as const;
export type LegacyRole = (typeof LEGACY_ROLES)[number];
/** No business operation is authorized until a reviewed policy exists. */
export function canAccessBusinessOperation(): false { return false; }
