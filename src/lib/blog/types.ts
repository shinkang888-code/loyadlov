// filepath: src/lib/blog/types.ts
/**
 * 네이버 블로그 자동작성 — 공통 타입.
 * DAF N Blog Assistant / Review Brief Studio 의 순수 로직을 loyadbeta 로 이식한 모듈에서 공유.
 */

export type MediaRequirements = {
  imageMinCount: number;
  videoRequired: boolean;
  videoMinSeconds: number;
  mapRequired: boolean;
  mapPlaceName: string;
};

export type NormalizedCampaign = {
  subjectValue: string;
  keywords: string[];
  keywordRequiredCount: number;
  bodyMinCharsNoSpaces: number;
  mediaRequirements: MediaRequirements;
  additionalRequests: string;
};

export type DraftOptions = {
  writer?: string;
};

export type ParsedDraft = {
  parsed: boolean;
  source: string;
  title: string;
  body: string;
  checklist: string[];
  rawResponse?: string;
  reason?: string;
};

export type DraftValidation = {
  ok: boolean;
  reason: string;
};

export type KeywordReportItem = {
  keyword: string;
  count: number;
  required: number;
  passed: boolean;
  missing: number;
};

export type TextMetrics = {
  bodyCharsNoSpaces: number;
  bodyTarget: number;
  bodyPassed: boolean;
  keywordReport: KeywordReportItem[];
};

export type MediaCheck = {
  id: string;
  label: string;
  required: number | boolean;
  actual: number | boolean;
  passed: boolean;
  enabled: boolean;
};

export type MediaVerification = {
  passed: boolean;
  checks: MediaCheck[];
};

export type RequestResult = {
  request: string;
  status: "passed" | "maybe_missing" | "missing" | "needs_review";
  reason: string;
};

export type VerificationResult = {
  passed: boolean;
  status: string;
  body: { charsNoSpaces: number; required: number; passed: boolean };
  keywords: KeywordReportItem[];
  media: MediaVerification;
  requestResults: RequestResult[];
  diagnostics: unknown[];
};

export type RevisionIssue = {
  id: string;
  severity: string;
  message: string;
};

export type RevisionResult = {
  source: string;
  aiPolished: boolean;
  fallbackReason: string;
  revisionStyle: string;
  passed: boolean;
  issues: RevisionIssue[];
  text: string;
};

export type NormalizedPost = {
  title?: string;
  sourceUrl?: string;
  bodyText?: string;
  extractedBody?: string;
  media?: { imageCount?: number; videoFound?: boolean; mapFound?: boolean };
  diagnostics?: unknown[];
};
