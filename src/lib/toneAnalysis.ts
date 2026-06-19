/** 본문과 업종 기반 톤 일치도 (0–100) — 휴리스틱 */
export function computeToneMatchScore(body: string, industry: string, tones: string[] = []): number {
  const text = body.trim();
  if (text.length < 20) return 0;

  let score = 65;

  if (text.length >= 80 && text.length <= 2000) score += 8;
  if (/#[\w가-힣]+/.test(text)) score += 7;
  if (/[\u{1F300}-\u{1FAFF}]/u.test(text)) score += 3;

  const industryLower = industry.toLowerCase();
  if (industryLower.includes("요식") || industryLower.includes("f&b") || industryLower.includes("카페")) {
    if (/맛|메뉴|예약|영업|오늘/.test(text)) score += 10;
  }
  if (industryLower.includes("뷰티") || industryLower.includes("헤어")) {
    if (/스타일|예약|케어|변화/.test(text)) score += 10;
  }

  for (const t of tones) {
    if (t && text.includes(t.replace(/^#/, ""))) score += 4;
  }

  return Math.min(98, Math.max(40, score));
}

export function describeToneMatch(score: number): string {
  if (score >= 85) return "매우 잘 맞음";
  if (score >= 70) return "양호";
  if (score >= 50) return "보통";
  return "가이드라인 보완 필요";
}
