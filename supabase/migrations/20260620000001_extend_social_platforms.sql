-- TikTok / Kakao 소셜 플랫폼 확장

ALTER TABLE public.social_accounts DROP CONSTRAINT IF EXISTS social_accounts_platform_check;
ALTER TABLE public.social_accounts ADD CONSTRAINT social_accounts_platform_check
  CHECK (platform IN ('instagram', 'threads', 'youtube', 'naver_blog', 'tiktok', 'kakao'));

ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_platform_check;
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_platform_check
  CHECK (platform IN ('instagram', 'threads', 'youtube', 'naver_blog', 'tiktok', 'kakao'));
