/** Partial V1 customers/suppliers mapping; no database connection or migration. */
export interface LegacyContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  created_at: Date;
}
