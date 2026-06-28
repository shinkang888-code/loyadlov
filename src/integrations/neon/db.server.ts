import { neon, neonConfig } from "@neondatabase/serverless";

// Server-only Neon Postgres client.
// Read DATABASE_URL inside functions — never at module scope on edge/serverless.

neonConfig.fetchConnectionCache = true;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. Set it from Neon CLI: neon connection-string --project-id flat-moon-84891358",
    );
  }
  return url;
}

export function getSql() {
  return neon(getDatabaseUrl());
}

export type Sql = ReturnType<typeof getSql>;
