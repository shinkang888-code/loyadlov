/**
 * Apply neon/migrations/*.sql in order via DATABASE_URL
 * Usage: node scripts/apply-neon-migrations.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { neonConfig, Pool } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(join(root, ".env.vercel"));
loadEnvFile(join(root, ".env"));

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL missing — run: vercel env pull .env.vercel");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const dir = join(root, "neon", "migrations");
const only = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .filter((f) => !only || f >= only);

console.log(`Applying ${files.length} migration(s) to Neon...`);

for (const file of files) {
  const body = readFileSync(join(dir, file), "utf8");
  console.log(`→ ${file}`);
  try {
    await pool.query(body);
    console.log(`  OK`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (file === "001_initial_schema.sql" && /already exists/i.test(msg)) {
      console.log(`  SKIP (already applied)`);
      continue;
    }
    console.error(`  FAIL: ${msg.slice(0, 300)}`);
    process.exit(1);
  }
}

await pool.end();

console.log("Done.");
