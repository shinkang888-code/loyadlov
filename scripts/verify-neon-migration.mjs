import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.vercel", ".env"]) {
  try {
    for (const line of readFileSync(join(root, f), "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i < 1 || process.env[line.slice(0, i)]) continue;
      process.env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, "");
    }
  } catch {}
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const fns = await pool.query(
  `SELECT proname FROM pg_proc WHERE proname IN ('claim_social_post','claim_due_social_posts','claim_generation_jobs') ORDER BY 1`,
);
console.log("functions:", fns.rows.map((r) => r.proname).join(", "));
const col = await pool.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='generation_jobs' AND column_name='claimed_at'`,
);
console.log("claimed_at:", col.rows.length ? "yes" : "no");
const pol = await pool.query(
  `SELECT COUNT(*)::int AS n FROM pg_policies WHERE policyname='tenant_isolation'`,
);
console.log("rls_policies:", pol.rows[0]?.n);
await pool.end();
