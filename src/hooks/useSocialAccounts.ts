import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listSocialAccountsFn } from "@/lib/social.functions";
import type { SocialAccountPublic } from "@/lib/social/types";

type OAuthConfig = {
  meta: boolean;
  youtube: boolean;
  naver: boolean;
  tiktok: boolean;
  kakao: boolean;
};

export function useSocialAccounts(storeCode?: string) {
  const listAccounts = useServerFn(listSocialAccountsFn);
  const [accounts, setAccounts] = useState<SocialAccountPublic[]>([]);
  const [config, setConfig] = useState<OAuthConfig>({
    meta: false,
    youtube: false,
    naver: false,
    tiktok: false,
    kakao: false,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAccounts({ data: { storeCode } });
      const data = res as { accounts: SocialAccountPublic[]; config: OAuthConfig };
      setAccounts(data.accounts ?? []);
      setConfig(data.config ?? { meta: false, youtube: false, naver: false, tiktok: false, kakao: false });
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [listAccounts, storeCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isConnected = useCallback(
    (platform: SocialAccountPublic["platform"]) => accounts.some((a) => a.platform === platform),
    [accounts]
  );

  return { accounts, config, loading, refresh, isConnected };
}
