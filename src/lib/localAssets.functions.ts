// filepath: src/lib/localAssets.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canManagePlatformSettings } from "@/lib/platformAuth.server";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";
import {
  assertSafeRoot,
  deleteLocalAsset,
  isLocalAssetsEnabled,
  listLocalAssets,
  loadLocalAssetsConfig,
  mkdirLocalAsset,
  readLocalAssetBytes,
  resolveStoreRootForUser,
  saveLocalAssetsConfig,
  uploadLocalAsset,
} from "@/lib/localAssets.server";

const StoreCodeInput = z.object({ storeCode: z.string().trim().optional() });

export const getLocalAssetsStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreCodeInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const enabled = isLocalAssetsEnabled();
    if (!enabled) {
      return { enabled: false, configured: false, rootPath: null as string | null, canEdit: false };
    }
    const canEdit = await canManagePlatformSettings(context.supabase, context.userId);
    let rootPath: string | null = null;
    try {
      rootPath = await resolveStoreRootForUser(context.supabase, context.userId, data.storeCode);
    } catch {
      rootPath = null;
    }
    return { enabled: true, configured: Boolean(rootPath), rootPath, canEdit };
  });

export const getLocalAssetsConfigFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreCodeInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    if (!isLocalAssetsEnabled()) throw new Error("로컬 폴더 소재함은 개발 환경에서만 사용할 수 있습니다.");
    const canEdit = await canManagePlatformSettings(context.supabase, context.userId);
    const cfg = await loadLocalAssetsConfig();
    const storeCode = data.storeCode
      ? await resolveRequestedStoreCode(context.supabase, context.userId, data.storeCode)
      : null;
    const storeRoot = storeCode ? (cfg.byStore?.[storeCode] ?? "") : "";
    return {
      canEdit,
      defaultRoot:
        cfg.defaultRoot ??
        process.env.LOCAL_ASSETS_ROOT ??
        "C:\\Users\\user\\dev\\loyadbeta\\local-assets",
      storeRoot,
      allowedPrefixes: (process.env.LOCAL_ASSETS_ALLOWED_PREFIXES ?? "C:\\Users\\user\\dev").split(";"),
    };
  });

export const setLocalAssetsRootFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreCodeInput.extend({
      rootPath: z.string().trim().min(3).max(500),
      scope: z.enum(["store", "default"]).optional().default("store"),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!isLocalAssetsEnabled()) throw new Error("로컬 폴더 설정은 개발 환경에서만 가능합니다.");
    const canEdit = await canManagePlatformSettings(context.supabase, context.userId);
    if (!canEdit) throw new Error("폴더 경로는 owner 또는 admin만 변경할 수 있습니다.");

    const safe = assertSafeRoot(data.rootPath);
    const cfg = await loadLocalAssetsConfig();

    if (data.scope === "default") {
      await saveLocalAssetsConfig({ ...cfg, defaultRoot: safe });
      return { ok: true, rootPath: safe };
    }

    const storeCode = await resolveRequestedStoreCode(
      context.supabase,
      context.userId,
      data.storeCode
    );

    await saveLocalAssetsConfig({
      ...cfg,
      byStore: { ...(cfg.byStore ?? {}), [storeCode]: safe },
    });
    return { ok: true, rootPath: safe, storeCode };
  });

export const listLocalAssetsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreCodeInput.extend({ relativeDir: z.string().max(500).optional().default("") }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const root = await resolveStoreRootForUser(context.supabase, context.userId, data.storeCode);
    return listLocalAssets(root, data.relativeDir);
  });

export const uploadLocalAssetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreCodeInput.extend({
      relativeDir: z.string().max(500).optional().default(""),
      name: z.string().min(1).max(255),
      base64: z.string().min(1),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const root = await resolveStoreRootForUser(context.supabase, context.userId, data.storeCode);
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bin.byteLength > 50 * 1024 * 1024) throw new Error("50MB 초과 파일은 업로드할 수 없습니다.");
    const file = await uploadLocalAsset({
      root,
      relativeDir: data.relativeDir,
      name: data.name,
      data: bin,
    });
    return { file };
  });

export const deleteLocalAssetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreCodeInput.extend({ relativePath: z.string().min(1).max(500) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const root = await resolveStoreRootForUser(context.supabase, context.userId, data.storeCode);
    await deleteLocalAsset(root, data.relativePath);
    return { ok: true };
  });

export const mkdirLocalAssetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreCodeInput.extend({
      relativeDir: z.string().max(500).optional().default(""),
      folderName: z.string().min(1).max(120),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const root = await resolveStoreRootForUser(context.supabase, context.userId, data.storeCode);
    const folder = await mkdirLocalAsset(root, data.relativeDir, data.folderName);
    return { folder };
  });

export const getLocalAssetPreviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreCodeInput.extend({ relativePath: z.string().min(1).max(500) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const root = await resolveStoreRootForUser(context.supabase, context.userId, data.storeCode);
    const { data: bytes, mimeType } = await readLocalAssetBytes(root, data.relativePath, 5 * 1024 * 1024);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
  });
