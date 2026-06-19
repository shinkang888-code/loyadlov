import { listSocialAccounts } from "@/lib/social/socialAccountServer";
import { decryptToken } from "@/lib/social/tokenCrypto";
import { fetchNaverBlogCategories } from "@/lib/social/naverOAuth";

export async function getNaverBlogCategoriesForStore(storeCode: string) {
  const accounts = await listSocialAccounts(storeCode);
  const naver = accounts.find((a) => a.platform === "naver_blog");
  if (!naver) return [];

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("social_accounts")
    .select("access_token_enc")
    .eq("id", naver.id)
    .maybeSingle();

  if (!data?.access_token_enc) return [];
  const token = decryptToken(data.access_token_enc);
  if (!token) return [];

  return fetchNaverBlogCategories(token);
}
