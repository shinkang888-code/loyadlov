/**
 * Meta OAuth 후 Instagram·Threads 프로필·페이지 정보 수집
 */

export type MetaConnectionInfo = {
  facebookUserId: string;
  facebookUserName: string;
  threadsUserId: string | null;
  threadsUsername: string | null;
  instagramBusinessAccountId: string | null;
  pageId: string | null;
  pageName: string | null;
  pageAccessToken: string | null;
};

export async function fetchThreadsProfile(
  accessToken: string
): Promise<{ id: string; username: string } | null> {
  const res = await fetch(
    `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string; username?: string };
  if (!data.id) return null;
  return { id: data.id, username: data.username ?? data.id };
}

export async function fetchFacebookPages(accessToken: string): Promise<
  Array<{
    id: string;
    name: string;
    accessToken: string;
    instagramBusinessAccountId: string | null;
  }>
> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string };
    }>;
  };
  return (data.data ?? [])
    .filter((p) => p.id && p.access_token)
    .map((p) => ({
      id: p.id!,
      name: p.name ?? p.id!,
      accessToken: p.access_token!,
      instagramBusinessAccountId: p.instagram_business_account?.id ?? null,
    }));
}

export async function buildMetaConnectionInfo(
  accessToken: string,
  facebookUserId: string,
  facebookUserName: string
): Promise<MetaConnectionInfo> {
  const [threads, pages] = await Promise.all([
    fetchThreadsProfile(accessToken),
    fetchFacebookPages(accessToken),
  ]);

  const pageWithIg = pages.find((p) => p.instagramBusinessAccountId) ?? pages[0] ?? null;

  return {
    facebookUserId,
    facebookUserName,
    threadsUserId: threads?.id ?? null,
    threadsUsername: threads?.username ?? null,
    instagramBusinessAccountId: pageWithIg?.instagramBusinessAccountId ?? null,
    pageId: pageWithIg?.id ?? null,
    pageName: pageWithIg?.name ?? null,
    pageAccessToken: pageWithIg?.accessToken ?? null,
  };
}
