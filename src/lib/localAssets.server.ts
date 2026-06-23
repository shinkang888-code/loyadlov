// filepath: src/lib/localAssets.server.ts
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const LOCAL_ASSETS_CONFIG_KEY = "local_assets_config";

export type LocalAssetsConfig = {
  defaultRoot?: string;
  byStore?: Record<string, string>;
};

export type LocalAssetItem = {
  name: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
  mimeType: string | null;
};

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"]);

export function isLocalAssetsEnabled(): boolean {
  if (process.env.LOCAL_ASSETS_ENABLED === "false") return false;
  if (process.env.LOCAL_ASSETS_ENABLED === "true") return true;
  return process.env.NODE_ENV === "development";
}

function allowedPrefixes(): string[] {
  const raw =
    process.env.LOCAL_ASSETS_ALLOWED_PREFIXES?.trim() || "C:\\Users\\user\\dev";
  return raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function assertSafeRoot(rootPath: string): string {
  const path = awaitImportPath();
  const normalized = path.resolve(rootPath.trim());
  if (!path.isAbsolute(normalized)) {
    throw new Error("절대 경로를 입력하세요. 예: C:\\Users\\user\\dev\\loyadbeta\\local-assets");
  }
  const prefixes = allowedPrefixes();
  const ok = prefixes.some((prefix) => {
    const base = path.resolve(prefix);
    return (
      normalized.toLowerCase() === base.toLowerCase() ||
      normalized.toLowerCase().startsWith(base.toLowerCase() + path.sep)
    );
  });
  if (!ok) {
    throw new Error(`허용된 경로 접두사: ${prefixes.join(", ")}`);
  }
  return normalized;
}

export function resolveUnderRoot(root: string, relativePath: string): string {
  const path = awaitImportPath();
  const rootResolved = path.resolve(root);
  const safeRel = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const target = path.resolve(rootResolved, safeRel || ".");
  const rel = path.relative(rootResolved, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("잘못된 경로입니다.");
  }
  return target;
}

function awaitImportPath(): typeof import("node:path") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node:path") as typeof import("node:path");
}

function awaitImportFs(): typeof import("node:fs/promises") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node:fs/promises") as typeof import("node:fs/promises");
}

function guessMime(name: string): string | null {
  const path = awaitImportPath();
  const ext = path.extname(name).toLowerCase();
  if (IMAGE_EXT.has(ext)) return `image/${ext === ".jpg" ? "jpeg" : ext.slice(1)}`;
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".pdf") return "application/pdf";
  return null;
}

export async function loadLocalAssetsConfig(): Promise<LocalAssetsConfig> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", LOCAL_ASSETS_CONFIG_KEY)
      .maybeSingle();
    return (data?.value as LocalAssetsConfig | null) ?? {};
  } catch {
    return {};
  }
}

export async function saveLocalAssetsConfig(config: LocalAssetsConfig): Promise<void> {
  const { error } = await supabaseAdmin.from("app_settings").upsert({
    key: LOCAL_ASSETS_CONFIG_KEY,
    value: config,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function resolveStoreRoot(storeCode: string): Promise<string> {
  const cfg = await loadLocalAssetsConfig();
  const fromStore = cfg.byStore?.[storeCode]?.trim();
  if (fromStore) return assertSafeRoot(fromStore);
  if (cfg.defaultRoot?.trim()) return assertSafeRoot(cfg.defaultRoot);
  const env = process.env.LOCAL_ASSETS_ROOT?.trim();
  if (env) return assertSafeRoot(env);
  return assertSafeRoot("C:\\Users\\user\\dev\\loyadbeta\\local-assets");
}

export async function resolveStoreRootForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  storeCode?: string | null
): Promise<string> {
  const code = await resolveRequestedStoreCode(supabase, userId, storeCode);
  return resolveStoreRoot(code);
}

export async function ensureRootExists(root: string): Promise<void> {
  const fs = awaitImportFs();
  await fs.mkdir(root, { recursive: true });
}

export async function listLocalAssets(
  root: string,
  relativeDir = ""
): Promise<{ root: string; relativeDir: string; items: LocalAssetItem[] }> {
  if (!isLocalAssetsEnabled()) {
    throw new Error("로컬 폴더 소재함은 개발 환경에서만 사용할 수 있습니다.");
  }
  const fs = awaitImportFs();
  const path = awaitImportPath();
  const dir = resolveUnderRoot(root, relativeDir);
  await ensureRootExists(dir);

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const items: LocalAssetItem[] = [];

  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const rel = relativeDir ? `${relativeDir}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    const st = await fs.stat(full);
    items.push({
      name: ent.name,
      relativePath: rel.replace(/\\/g, "/"),
      size: st.size,
      modifiedAt: st.mtime.toISOString(),
      isDirectory: ent.isDirectory(),
      mimeType: ent.isDirectory() ? null : guessMime(ent.name),
    });
  }

  items.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });

  return { root, relativeDir: relativeDir.replace(/\\/g, "/"), items };
}

export async function uploadLocalAsset(params: {
  root: string;
  relativeDir: string;
  name: string;
  data: Uint8Array;
}): Promise<LocalAssetItem> {
  if (!isLocalAssetsEnabled()) throw new Error("로컬 업로드는 개발 환경에서만 가능합니다.");
  const fs = awaitImportFs();
  const path = awaitImportPath();
  const safeName = params.name.replace(/[<>:"/\\|?*]/g, "_").slice(0, 200);
  if (!safeName) throw new Error("파일명이 올바르지 않습니다.");

  const dir = resolveUnderRoot(params.root, params.relativeDir);
  await ensureRootExists(dir);
  const full = path.join(dir, safeName);
  await fs.writeFile(full, params.data);
  const st = await fs.stat(full);
  const rel = params.relativeDir ? `${params.relativeDir}/${safeName}` : safeName;

  return {
    name: safeName,
    relativePath: rel.replace(/\\/g, "/"),
    size: st.size,
    modifiedAt: st.mtime.toISOString(),
    isDirectory: false,
    mimeType: guessMime(safeName),
  };
}

export async function deleteLocalAsset(root: string, relativePath: string): Promise<void> {
  if (!isLocalAssetsEnabled()) throw new Error("로컬 삭제는 개발 환경에서만 가능합니다.");
  const fs = awaitImportFs();
  const full = resolveUnderRoot(root, relativePath);
  const st = await fs.stat(full);
  if (st.isDirectory()) await fs.rm(full, { recursive: true, force: true });
  else await fs.unlink(full);
}

export async function mkdirLocalAsset(
  root: string,
  relativeDir: string,
  folderName: string
): Promise<LocalAssetItem> {
  const fs = awaitImportFs();
  const safe = folderName.replace(/[<>:"/\\|?*]/g, "_").trim();
  if (!safe) throw new Error("폴더명을 입력하세요.");
  const parent = resolveUnderRoot(root, relativeDir);
  const full = awaitImportPath().join(parent, safe);
  resolveUnderRoot(root, relativeDir ? `${relativeDir}/${safe}` : safe);
  await fs.mkdir(full, { recursive: true });
  const st = await fs.stat(full);
  const rel = relativeDir ? `${relativeDir}/${safe}` : safe;
  return {
    name: safe,
    relativePath: rel.replace(/\\/g, "/"),
    size: 0,
    modifiedAt: st.mtime.toISOString(),
    isDirectory: true,
    mimeType: null,
  };
}

export async function readLocalAssetBytes(
  root: string,
  relativePath: string,
  maxBytes = 15 * 1024 * 1024
): Promise<{ data: Uint8Array; mimeType: string }> {
  const fs = awaitImportFs();
  const full = resolveUnderRoot(root, relativePath);
  const st = await fs.stat(full);
  if (st.isDirectory()) throw new Error("폴더는 열 수 없습니다.");
  if (st.size > maxBytes) throw new Error("파일이 너무 큽니다.");
  const buf = await fs.readFile(full);
  return { data: new Uint8Array(buf), mimeType: guessMime(relativePath) ?? "application/octet-stream" };
}
