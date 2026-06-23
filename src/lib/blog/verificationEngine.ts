// filepath: src/lib/blog/verificationEngine.ts
/**
 * 발행글이 캠페인 조건(본문 길이/키워드 횟수/미디어 요건)을 충족하는지 검수.
 * 원본: daf-review-brief-studio/electron/lib/verification-engine.cjs.
 */
import { buildTextMetrics } from "./textMetrics";
import type {
  MediaRequirements,
  MediaVerification,
  NormalizedCampaign,
  NormalizedPost,
  RequestResult,
  VerificationResult,
} from "./types";

export function verifyMediaRequirements(
  requirements: Partial<MediaRequirements> = {},
  observed: { imageCount?: number; videoFound?: boolean; mapFound?: boolean } = {},
): MediaVerification {
  const imageMin = Math.max(0, Number.parseInt(String(requirements.imageMinCount ?? 0), 10) || 0);
  const imageCount = Math.max(0, Number.parseInt(String(observed.imageCount ?? 0), 10) || 0);
  const videoRequired = Boolean(requirements.videoRequired);
  const videoFound = Boolean(observed.videoFound);
  const mapRequired = Boolean(requirements.mapRequired);
  const mapFound = Boolean(observed.mapFound);
  const checks = [
    {
      id: "image_count",
      label: "이미지",
      required: imageMin,
      actual: imageCount,
      passed: imageCount >= imageMin,
      enabled: imageMin > 0,
    },
    {
      id: "video_presence",
      label: "동영상",
      required: videoRequired,
      actual: videoFound,
      passed: !videoRequired || videoFound,
      enabled: videoRequired,
    },
    {
      id: "map_presence",
      label: "지도",
      required: mapRequired,
      actual: mapFound,
      passed: !mapRequired || mapFound,
      enabled: mapRequired,
    },
  ];
  return {
    passed: checks.filter((c) => c.enabled).every((c) => c.passed),
    checks,
  };
}

export function verifyPostAgainstCampaign(
  campaign: NormalizedCampaign,
  post: NormalizedPost = {},
  requestResults: RequestResult[] = [],
): VerificationResult {
  const src = post && typeof post === "object" ? post : {};
  const bodyText = String(src.bodyText ?? src.extractedBody ?? "");
  const metrics = buildTextMetrics(bodyText, campaign);
  const media = verifyMediaRequirements(campaign?.mediaRequirements || {}, src.media || {});
  const keywordsPassed = metrics.keywordReport.every((k) => k.passed);
  const requestsPassed =
    !Array.isArray(requestResults) ||
    requestResults.every((r) => !["missing", "maybe_missing"].includes(String(r.status || "")));
  const passed = Boolean(metrics.bodyPassed && keywordsPassed && media.passed && requestsPassed);
  return {
    passed,
    status: passed ? "passed" : "needs_review",
    body: {
      charsNoSpaces: metrics.bodyCharsNoSpaces,
      required: metrics.bodyTarget,
      passed: metrics.bodyPassed,
    },
    keywords: metrics.keywordReport,
    media,
    requestResults: Array.isArray(requestResults) ? requestResults : [],
    diagnostics: Array.isArray(src.diagnostics) ? src.diagnostics : [],
  };
}
