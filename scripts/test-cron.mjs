/**
 * Vercel cron 엔드포인트 스모크 테스트
 * Usage: node scripts/test-cron.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

const secret = process.env.CRON_SECRET?.trim();
const appUrl = process.env.APP_URL?.trim()?.replace(/\/$/, "");
const base =
  process.env.CRON_TEST_BASE?.trim()?.replace(/\/$/, "") ||
  (appUrl && !/localhost|127\.0\.0\.1/.test(appUrl) ? appUrl : null) ||
  "https://loyadlov.vercel.app";

if (!secret) {
  console.error("CRON_SECRET missing — vercel env pull .env.vercel");
  process.exit(1);
}

const paths = ["/api/cron/generation-worker", "/api/cron/social-publish", "/api/cron/threadbot-worker"];

for (const path of paths) {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`${path}: ${res.status} ${body.slice(0, 120)}`);
  if (!res.ok) process.exit(1);
}
console.log("OK");
