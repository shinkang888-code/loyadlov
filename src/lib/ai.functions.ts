import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateTextContent, type TextGenResult } from "@/lib/generation/aiCore.server";

const GenInput = z.object({
  store: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(80).optional().default(""),
  tone: z.array(z.string().max(20)).max(5).optional().default([]),
  keyword: z.string().trim().max(120).optional().default(""),
  channel: z.enum(["instagram", "tiktok", "naver", "kakao"]).optional().default("instagram"),
});

export type GenerateContentResult = TextGenResult;

/** Generate SNS post body + hashtags via Lovable AI Gateway (Gemini Flash). */
export const generateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenInput.parse(input))
  .handler(async ({ data }): Promise<GenerateContentResult> => generateTextContent(data));
