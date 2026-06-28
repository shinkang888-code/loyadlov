/**
 * 소셜 발행 인터록(claim_social_post) 스모크 테스트
 * Usage: node scripts/test-social-interlock.mjs
 */
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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing — vercel env pull .env.vercel");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const insert = await pool.query(
    `INSERT INTO public.social_posts (store_code, platform, status, caption, scheduled_at)
     VALUES ('DEMO-2026', 'threads', 'scheduled', '[test-interlock]', now() - interval '1 minute')
     RETURNING id, status`,
  );
  const id = insert.rows[0]?.id;
  if (!id) throw new Error("insert failed");

  const first = await pool.query(`SELECT * FROM public.claim_social_post($1::uuid)`, [id]);
  const row1 = first.rows[0];
  if (!row1 || row1.status !== "publishing") {
    throw new Error(`first claim expected publishing, got ${row1?.status ?? "null"}`);
  }

  const second = await pool.query(`SELECT * FROM public.claim_social_post($1::uuid)`, [id]);
  if (second.rows[0]?.id) {
    throw new Error(`second claim should be rejected, got status=${second.rows[0]?.status}`);
  }

  const statusCheck = await pool.query(`SELECT status FROM public.social_posts WHERE id = $1`, [id]);
  if (statusCheck.rows[0]?.status !== "publishing") {
    throw new Error(`expected publishing after first claim, got ${statusCheck.rows[0]?.status}`);
  }

  console.log("OK: claim_social_post interlock — first claim publishing, second rejected");
} finally {
  await pool.query(`DELETE FROM public.social_posts WHERE caption = '[test-interlock]'`);
  await pool.end();
}
