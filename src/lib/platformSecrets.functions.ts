import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canManagePlatformSettings } from "@/lib/platformAuth.server";
import {
  computeSetupPercent,
  getPlatformSetupStatus,
  loadPlatformSecretsFromDb,
  maskSecret,
  savePlatformSecrets,
  type PlatformSecrets,
} from "@/lib/platformSecrets.server";

const SecretsPatch = z
  .object({
    lovableApiKey: z.string().max(500).optional(),
    appUrl: z.string().max(300).optional(),
    cronSecret: z.string().min(16).max(200).optional(),
    socialTokenEncryptionKey: z.string().min(16).max(200).optional(),
    googleClientEmail: z.string().email().max(200).optional(),
    googlePrivateKey: z.string().max(8000).optional(),
    googleDriveRootFolderId: z.string().max(120).optional(),
    stripeSecretKey: z.string().max(300).optional(),
    stripePublishableKey: z.string().max(300).optional(),
    stripeWebhookSecret: z.string().max(300).optional(),
    stripePriceStandard: z.string().max(120).optional(),
    stripePricePremium: z.string().max(120).optional(),
    runwayApiKey: z.string().max(500).optional(),
  })
  .partial();

export const getPlatformSetupStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const canEdit = await canManagePlatformSettings(context.supabase, context.userId);
    const status = await getPlatformSetupStatus();
    return {
      canEdit,
      status,
      percentComplete: computeSetupPercent(status),
      readyForPublish:
        status.lovableApiKey &&
        status.appUrl &&
        (status.metaOAuth || status.youtubeOAuth || status.naverOAuth),
    };
  });

export const getPlatformSecretsMaskedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const canEdit = await canManagePlatformSettings(context.supabase, context.userId);
    if (!canEdit) throw new Error("플랫폼 설정은 매장 소유자(owner) 또는 관리자(admin)만 변경할 수 있습니다.");

    const db = await loadPlatformSecretsFromDb();
    const masked: Record<string, string | null> = {};
    for (const key of Object.keys(db) as (keyof PlatformSecrets)[]) {
      masked[key] = maskSecret(db[key]);
    }

    return {
      masked,
      appUrl: db.appUrl ?? "",
      googleClientEmail: db.googleClientEmail ?? "",
      googleDriveRootFolderId: db.googleDriveRootFolderId ?? "",
      stripePublishableKey: db.stripePublishableKey ?? "",
      stripePriceStandard: db.stripePriceStandard ?? "",
      stripePricePremium: db.stripePricePremium ?? "",
    };
  });

export const savePlatformSecretsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SecretsPatch.parse(input))
  .handler(async ({ data, context }) => {
    const canEdit = await canManagePlatformSettings(context.supabase, context.userId);
    if (!canEdit) throw new Error("플랫폼 설정은 매장 소유자(owner) 또는 관리자(admin)만 변경할 수 있습니다.");

    const ok = await savePlatformSecrets(data);
    if (!ok) throw new Error("설정 저장에 실패했습니다.");
    const status = await getPlatformSetupStatus();
    return { ok: true, percentComplete: computeSetupPercent(status), status };
  });

export const generatePlatformTokenFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const canEdit = await canManagePlatformSettings(context.supabase, context.userId);
    if (!canEdit) throw new Error("권한이 없습니다.");
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { token };
  });
