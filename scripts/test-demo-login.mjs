import { chromium } from "playwright";

const URL = "https://loyadlov.vercel.app/auth";
const logs = [];
const network = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));
page.on("request", (req) => {
  const u = req.url();
  if (u.includes("/api/auth") || u.includes("demoLogin") || u.includes("_serverFn")) {
    network.push(`>> ${req.method()} ${u}`);
  }
});
page.on("response", async (res) => {
  const u = res.url();
  if (u.includes("/api/auth") || u.includes("demoLogin") || u.includes("_serverFn")) {
    let body = "";
    try {
      if (res.request().method() !== "GET" || u.includes("get-session")) {
        body = (await res.text()).slice(0, 200);
      }
    } catch {}
    network.push(`<< ${res.status()} ${u} ${body}`);
  }
});

console.log("=== Navigate ===");
await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
console.log("Title:", await page.title());

console.log("\n=== Click demo button ===");
const demoBtn = page.getByRole("button", { name: /데모로 둘러보기/ });
await demoBtn.click();

await page.waitForURL(/\/admin/, { timeout: 30000 });

const loading = page.getByText("워크스페이스 준비 중...");
await loading.waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});

await page.waitForTimeout(2000);

const errText = await page.locator("text=Failed to retrieve").count();
const errAny = await page.locator('[class*="destructive"]').first().textContent().catch(() => null);
const url = page.url();
const stillLoading = (await loading.count()) > 0 && (await loading.isVisible().catch(() => false));
const adminShell = await page.locator("nav, aside, [data-testid='admin-shell']").first().isVisible().catch(() => false);

console.log("\n=== Result ===");
console.log("Final URL:", url);
console.log("Still on loading screen:", stillLoading);
console.log("Admin shell visible:", adminShell);
console.log("Error visible:", errText > 0 ? errAny : "none");
console.log("\n=== Network (auth/serverFn) ===");
network.forEach((l) => console.log(l));
console.log("\n=== Console ===");
logs.slice(-20).forEach((l) => console.log(l));

const cookies = await context.cookies();
console.log("\n=== Cookies ===");
cookies.filter((c) => c.name.includes("neon-auth")).forEach((c) => console.log(c.name, c.sameSite, c.path));

await browser.close();
const ok = url.includes("/admin") && !stillLoading;
process.exit(ok ? 0 : 1);
