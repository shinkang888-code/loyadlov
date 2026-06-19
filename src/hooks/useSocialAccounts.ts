import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listSocialAccountsFn } from "@/lib/social.functions";
import type { SocialAccountPublic } from "@/lib/social/types";

export function useSocialAccounts() {
  const listAccounts = useServerFn(listSocialAccountsFn);
  const [accounts, setAccounts] = useState<SocialAccountPublic[]>([]);
  const [config, setConfig] = useState({ meta: false, youtube: false, naver: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAccounts();
      const data = res as { accounts: SocialAccountPublic[]; config: typeof config };
      setAccounts(data.accounts ?? []);
      setConfig(data.config ?? { meta: false, youtube: false, naver: false });
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [listAccounts]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isConnected = useCallback(
    (platform: SocialAccountPublic["platform"]) => accounts.some((a) => a.platform === platform),
    [accounts]
  );

  return { accounts, config, loading, refresh, isConnected };
}
