import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function rootFolder(): string {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured.");
  return id;
}

export const listDriveAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { folderId?: string }) =>
    z.object({ folderId: z.string().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { listFolderFiles } = await import("./google-drive.server");
    const files = await listFolderFiles(data.folderId ?? rootFolder());
    return { files, rootFolderId: rootFolder() };
  });

export const uploadDriveAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; mimeType: string; base64: string; folderId?: string }) =>
    z
      .object({
        name: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(120),
        base64: z.string().min(1),
        folderId: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { uploadFileToDrive } = await import("./google-drive.server");
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const file = await uploadFileToDrive({
      folderId: data.folderId ?? rootFolder(),
      name: data.name,
      mimeType: data.mimeType,
      data: bin,
    });
    return { file };
  });

export const deleteDriveAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileId: string }) =>
    z.object({ fileId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { deleteDriveFile } = await import("./google-drive.server");
    await deleteDriveFile(data.fileId);
    return { ok: true };
  });
