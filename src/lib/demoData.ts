// filepath: src/lib/demoData.ts
// API 연동 전 UI 검토용 더미 데이터. 데모 스토어(DEMO-2026)에서만 사용되며
// 실제 매장 코드는 영향받지 않는다(서버 데이터 그대로 사용).
import type { QueueItem, AnalyticsSummary } from "@/lib/profiles.functions";
import type { GenerationJobPublic } from "@/lib/generation.functions";
import type {
  Consultation,
  ConsultMessage,
  KakaoSettings,
} from "@/lib/kakaoConsult.functions";
import type { CrmMember, MemberMessage } from "@/lib/members.functions";
import type {
  ThreadbotRules,
  ThreadbotActivity,
  ThreadbotSummary,
} from "@/lib/threadbot.functions";

export const DEMO_STORE_CODE = "DEMO-2026";

export function isDemoStore(storeCode?: string | null): boolean {
  return storeCode === DEMO_STORE_CODE;
}

/** n분 전 ISO */
function minsAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60_000).toISOString();
}
function inMins(n: number): string {
  return new Date(Date.now() + n * 60_000).toISOString();
}

/* ============================ 생성 큐 ============================ */
export function demoQueueItems(): QueueItem[] {
  return [
    {
      id: "demo-sch-1",
      kind: "schedule",
      title: "주말 브런치 세트 예약 발행",
      channel: "instagram",
      status: "scheduled",
      scheduledAt: inMins(180),
      storeCode: DEMO_STORE_CODE,
      createdAt: minsAgo(40),
    },
    {
      id: "demo-sch-2",
      kind: "schedule",
      title: "신메뉴 '흑임자 라떼' 티저",
      channel: "naver_blog",
      status: "scheduled",
      scheduledAt: inMins(60 * 20),
      storeCode: DEMO_STORE_CODE,
      createdAt: minsAgo(90),
    },
    {
      id: "demo-social-1",
      kind: "social",
      title: "오늘의 디저트 릴스",
      channel: "tiktok",
      status: "queued",
      scheduledAt: null,
      storeCode: DEMO_STORE_CODE,
      createdAt: minsAgo(12),
    },
    {
      id: "demo-draft-1",
      kind: "draft",
      title: "사장님 인사말 — 1주년 이벤트",
      channel: "instagram",
      status: "draft",
      scheduledAt: null,
      storeCode: DEMO_STORE_CODE,
      createdAt: minsAgo(220),
    },
    {
      id: "demo-social-2",
      kind: "social",
      title: "리뷰 이벤트 안내 카드뉴스",
      channel: "instagram",
      status: "published",
      scheduledAt: null,
      storeCode: DEMO_STORE_CODE,
      createdAt: daysAgo(1),
    },
  ];
}

export function demoGenJobs(): GenerationJobPublic[] {
  return [
    {
      id: "demo-job-proc-1",
      storeCode: DEMO_STORE_CODE,
      jobType: "image",
      status: "processing",
      progress: 62,
      batchId: null,
      input: { prompt: "흑임자 라떼 감성 컷" },
      result: null,
      errorMessage: null,
      draftId: null,
      createdAt: minsAgo(3),
      updatedAt: minsAgo(1),
      startedAt: minsAgo(3),
      completedAt: null,
    },
    {
      id: "demo-job-proc-2",
      storeCode: DEMO_STORE_CODE,
      jobType: "bulk_pack",
      status: "processing",
      progress: 28,
      batchId: "demo-batch-1",
      input: { count: 5 },
      result: null,
      errorMessage: null,
      draftId: null,
      createdAt: minsAgo(5),
      updatedAt: minsAgo(1),
      startedAt: minsAgo(5),
      completedAt: null,
    },
    {
      id: "demo-job-pending-1",
      storeCode: DEMO_STORE_CODE,
      jobType: "text",
      status: "pending",
      progress: 0,
      batchId: null,
      input: { keyword: "주말 한정 메뉴" },
      result: null,
      errorMessage: null,
      draftId: null,
      createdAt: minsAgo(2),
      updatedAt: minsAgo(2),
      startedAt: null,
      completedAt: null,
    },
    {
      id: "demo-job-done-1",
      storeCode: DEMO_STORE_CODE,
      jobType: "text",
      status: "completed",
      progress: 100,
      batchId: null,
      input: { keyword: "신상 베이글 소개" },
      result: { ok: true },
      errorMessage: null,
      draftId: "demo-draft-x",
      createdAt: minsAgo(50),
      updatedAt: minsAgo(46),
      startedAt: minsAgo(50),
      completedAt: minsAgo(46),
    },
    {
      id: "demo-job-done-2",
      storeCode: DEMO_STORE_CODE,
      jobType: "image",
      status: "completed",
      progress: 100,
      batchId: null,
      input: { prompt: "딸기 생크림 케이크" },
      result: { ok: true },
      errorMessage: null,
      draftId: null,
      createdAt: minsAgo(120),
      updatedAt: minsAgo(118),
      startedAt: minsAgo(120),
      completedAt: minsAgo(118),
    },
    {
      id: "demo-job-failed-1",
      storeCode: DEMO_STORE_CODE,
      jobType: "media_gen",
      status: "failed",
      progress: 40,
      batchId: null,
      input: { prompt: "매장 외관 영상" },
      result: null,
      errorMessage: "미디어 생성 API 응답 시간 초과 (데모)",
      draftId: null,
      createdAt: minsAgo(80),
      updatedAt: minsAgo(78),
      startedAt: minsAgo(80),
      completedAt: null,
    },
  ];
}

/* ============================ 카카오 상담 ============================ */
export function demoKakaoSettings(): KakaoSettings {
  return {
    storeCode: DEMO_STORE_CODE,
    channelPublicId: "_loyard_demo",
    channelChatUrl: "https://pf.kakao.com/_loyard_demo/chat",
    chatbotManageUrl: "https://center-pf.kakao.com/_loyard_demo/chatbot",
    webhookToken: "demo-webhook-token",
    botEnabled: true,
    autoReply: "안녕하세요! 로이어드 데모 카페입니다. 무엇을 도와드릴까요? 🍰",
    hasRestKey: false,
  };
}

export function demoConsultations(): Consultation[] {
  return [
    {
      id: "demo-consult-1",
      storeCode: DEMO_STORE_CODE,
      kakaoUserKey: "kakao-user-1",
      customerName: "김서연",
      status: "new",
      channel: "kakao",
      lastMessage: "혹시 주말에 단체 예약 가능한가요? 8명이요!",
      lastMessageAt: minsAgo(4),
      unreadCount: 2,
      note: null,
      createdAt: minsAgo(10),
      updatedAt: minsAgo(4),
    },
    {
      id: "demo-consult-2",
      storeCode: DEMO_STORE_CODE,
      kakaoUserKey: "kakao-user-2",
      customerName: "이준호",
      status: "active",
      channel: "kakao",
      lastMessage: "케이크 픽업 시간 변경하고 싶어요",
      lastMessageAt: minsAgo(35),
      unreadCount: 0,
      note: "VIP 단골 · 매주 화요일 방문",
      createdAt: minsAgo(120),
      updatedAt: minsAgo(35),
    },
    {
      id: "demo-consult-3",
      storeCode: DEMO_STORE_CODE,
      kakaoUserKey: "kakao-user-3",
      customerName: "박민지",
      status: "pending",
      channel: "kakao",
      lastMessage: "기프티콘 환불 문의드립니다",
      lastMessageAt: minsAgo(180),
      unreadCount: 1,
      note: null,
      createdAt: minsAgo(300),
      updatedAt: minsAgo(180),
    },
    {
      id: "demo-consult-4",
      storeCode: DEMO_STORE_CODE,
      kakaoUserKey: "kakao-user-4",
      customerName: "최유진",
      status: "closed",
      channel: "kakao",
      lastMessage: "감사합니다! 잘 먹었어요 😊",
      lastMessageAt: daysAgo(1),
      unreadCount: 0,
      note: "처리 완료",
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  ];
}

const DEMO_CONSULT_MESSAGES: Record<string, ConsultMessage[]> = {
  "demo-consult-1": [
    { id: "m1-1", consultationId: "demo-consult-1", direction: "in", content: "안녕하세요!", msgType: "text", createdAt: minsAgo(10) },
    { id: "m1-2", consultationId: "demo-consult-1", direction: "out", content: "안녕하세요! 로이어드 데모 카페입니다. 무엇을 도와드릴까요? 🍰", msgType: "auto", createdAt: minsAgo(10) },
    { id: "m1-3", consultationId: "demo-consult-1", direction: "in", content: "혹시 주말에 단체 예약 가능한가요?", msgType: "text", createdAt: minsAgo(5) },
    { id: "m1-4", consultationId: "demo-consult-1", direction: "in", content: "8명이요!", msgType: "text", createdAt: minsAgo(4) },
  ],
  "demo-consult-2": [
    { id: "m2-1", consultationId: "demo-consult-2", direction: "in", content: "케이크 픽업 시간 변경하고 싶어요", msgType: "text", createdAt: minsAgo(40) },
    { id: "m2-2", consultationId: "demo-consult-2", direction: "out", content: "네 준호님! 예약하신 픽업 시간을 몇 시로 변경해 드릴까요?", msgType: "agent", createdAt: minsAgo(35) },
  ],
  "demo-consult-3": [
    { id: "m3-1", consultationId: "demo-consult-3", direction: "in", content: "기프티콘 환불 문의드립니다", msgType: "text", createdAt: minsAgo(180) },
  ],
  "demo-consult-4": [
    { id: "m4-1", consultationId: "demo-consult-4", direction: "in", content: "딸기 케이크 정말 맛있었어요", msgType: "text", createdAt: daysAgo(1) },
    { id: "m4-2", consultationId: "demo-consult-4", direction: "out", content: "감사합니다! 또 방문해 주세요 😊", msgType: "agent", createdAt: daysAgo(1) },
    { id: "m4-3", consultationId: "demo-consult-4", direction: "in", content: "감사합니다! 잘 먹었어요 😊", msgType: "text", createdAt: daysAgo(1) },
  ],
};

export function demoConsultMessages(consultationId: string): ConsultMessage[] {
  return DEMO_CONSULT_MESSAGES[consultationId] ?? [];
}

/* ============================ 회원 관리 ============================ */
export function demoMembers(): CrmMember[] {
  return [
    {
      id: "demo-mem-1",
      storeCode: DEMO_STORE_CODE,
      name: "김서연",
      email: "seoyeon.kim@example.com",
      phone: "010-1234-5678",
      kakaoUserKey: "kakao-user-1",
      role: "vip",
      status: "active",
      memo: "흑임자 라떼 단골 · 생일 6월",
      tags: ["단골", "디저트러버"],
      lastContactAt: minsAgo(4),
      createdAt: daysAgo(120),
      updatedAt: minsAgo(4),
    },
    {
      id: "demo-mem-2",
      storeCode: DEMO_STORE_CODE,
      name: "이준호",
      email: "junho.lee@example.com",
      phone: "010-2345-6789",
      kakaoUserKey: "kakao-user-2",
      role: "member",
      status: "active",
      memo: "매주 화요일 케이크 픽업",
      tags: ["케이크예약"],
      lastContactAt: minsAgo(35),
      createdAt: daysAgo(60),
      updatedAt: minsAgo(35),
    },
    {
      id: "demo-mem-3",
      storeCode: DEMO_STORE_CODE,
      name: "박민지",
      email: null,
      phone: "010-3456-7890",
      kakaoUserKey: "kakao-user-3",
      role: "member",
      status: "lead",
      memo: "기프티콘 환불 문의 후 가입",
      tags: ["신규"],
      lastContactAt: minsAgo(180),
      createdAt: daysAgo(2),
      updatedAt: minsAgo(180),
    },
    {
      id: "demo-mem-4",
      storeCode: DEMO_STORE_CODE,
      name: "정태우",
      email: "taewoo@example.com",
      phone: null,
      kakaoUserKey: null,
      role: "staff",
      status: "active",
      memo: "주말 바리스타",
      tags: ["직원"],
      lastContactAt: daysAgo(3),
      createdAt: daysAgo(200),
      updatedAt: daysAgo(3),
    },
    {
      id: "demo-mem-5",
      storeCode: DEMO_STORE_CODE,
      name: "최유진",
      email: "yujin.choi@example.com",
      phone: "010-5678-9012",
      kakaoUserKey: "kakao-user-4",
      role: "member",
      status: "inactive",
      memo: null,
      tags: [],
      lastContactAt: daysAgo(30),
      createdAt: daysAgo(90),
      updatedAt: daysAgo(30),
    },
  ];
}

const DEMO_MEMBER_THREADS: Record<string, MemberMessage[]> = {
  "demo-mem-1": [
    { id: "mm1-1", memberId: "demo-mem-1", channel: "email", direction: "out", subject: "6월 VIP 한정 디저트 안내", content: "서연님, 이번 달 VIP 고객님께만 드리는 흑임자 라떼 1+1 쿠폰을 보내드려요!", status: "sent", createdAt: daysAgo(5) },
    { id: "mm1-2", memberId: "demo-mem-1", channel: "kakao", direction: "in", subject: null, content: "쿠폰 잘 받았어요! 감사합니다 😊", status: "received", createdAt: daysAgo(5) },
    { id: "mm1-3", memberId: "demo-mem-1", channel: "kakao", direction: "out", subject: null, content: "언제든 방문해 주세요!", status: "sent", createdAt: daysAgo(5) },
  ],
  "demo-mem-2": [
    { id: "mm2-1", memberId: "demo-mem-2", channel: "kakao", direction: "in", subject: null, content: "이번 주 케이크 예약할게요", status: "received", createdAt: daysAgo(7) },
    { id: "mm2-2", memberId: "demo-mem-2", channel: "kakao", direction: "out", subject: null, content: "네 준호님! 화요일 3시로 예약해 두었습니다.", status: "sent", createdAt: daysAgo(7) },
  ],
  "demo-mem-3": [
    { id: "mm3-1", memberId: "demo-mem-3", channel: "kakao", direction: "in", subject: null, content: "기프티콘 환불 문의드립니다", status: "received", createdAt: minsAgo(180) },
  ],
};

export function demoMemberThread(memberId: string): MemberMessage[] {
  return DEMO_MEMBER_THREADS[memberId] ?? [];
}

/* ============================ 성과 리포트 ============================ */
export function demoAnalytics(): AnalyticsSummary {
  return {
    totalPublished: 184,
    totalFailed: 6,
    totalScheduled: 12,
    publishedThisMonth: 23,
    byPlatform: {
      instagram: 92,
      naver_blog: 41,
      tiktok: 28,
      youtube: 14,
      threads: 9,
    },
    successRate: 97,
    recentPosts: [
      { id: "p1", platform: "instagram", status: "published", caption: "오늘의 디저트 — 딸기 생크림 케이크 🍓", publishedAt: minsAgo(120), createdAt: minsAgo(130) },
      { id: "p2", platform: "naver_blog", status: "published", caption: "성수동 숨은 카페 '로이어드' 방문 후기", publishedAt: minsAgo(400), createdAt: minsAgo(410) },
      { id: "p3", platform: "tiktok", status: "published", caption: "흑임자 라떼 만드는 과정 #shorts", publishedAt: daysAgo(1), createdAt: daysAgo(1) },
      { id: "p4", platform: "instagram", status: "failed", caption: "주말 한정 브런치 세트 (재시도 필요)", publishedAt: null, createdAt: daysAgo(1) },
      { id: "p5", platform: "youtube", status: "published", caption: "매장 브이로그 — 비 오는 날의 카페", publishedAt: daysAgo(2), createdAt: daysAgo(2) },
    ],
  };
}

export type DemoGaReport = {
  totals: {
    activeUsers: number;
    newUsers: number;
    sessions: number;
    screenPageViews: number;
    avgSessionDurationSec: number;
    bounceRate: number;
  };
  daily: { date: string; activeUsers: number; screenPageViews: number }[];
  topPages: { title: string; views: number }[];
  channels: { channel: string; sessions: number }[];
};

export function demoGaReport(range: "7d" | "28d" | "90d" = "28d"): DemoGaReport {
  const days = range === "7d" ? 7 : range === "28d" ? 28 : 90;
  const daily = Array.from({ length: days }).map((_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60_000);
    const base = 120 + Math.round(80 * Math.sin(i / 3)) + (i % 7 === 5 || i % 7 === 6 ? 90 : 0);
    const activeUsers = Math.max(40, base + Math.round(Math.random() * 40));
    return {
      date: date.toISOString().slice(0, 10),
      activeUsers,
      screenPageViews: Math.round(activeUsers * (1.8 + Math.random() * 0.6)),
    };
  });
  const totalUsers = daily.reduce((s, d) => s + d.activeUsers, 0);
  const totalViews = daily.reduce((s, d) => s + d.screenPageViews, 0);
  return {
    totals: {
      activeUsers: totalUsers,
      newUsers: Math.round(totalUsers * 0.58),
      sessions: Math.round(totalUsers * 1.25),
      screenPageViews: totalViews,
      avgSessionDurationSec: 142,
      bounceRate: 0.41,
    },
    daily,
    topPages: [
      { title: "메인 — 로이어드 데모 카페", views: Math.round(totalViews * 0.32) },
      { title: "메뉴 / 가격 안내", views: Math.round(totalViews * 0.21) },
      { title: "오시는 길 · 예약", views: Math.round(totalViews * 0.15) },
      { title: "신메뉴 — 흑임자 라떼", views: Math.round(totalViews * 0.11) },
      { title: "리뷰 이벤트", views: Math.round(totalViews * 0.07) },
    ],
    channels: [
      { channel: "Organic Search", sessions: Math.round(totalUsers * 0.44) },
      { channel: "Social (Instagram)", sessions: Math.round(totalUsers * 0.31) },
      { channel: "Direct", sessions: Math.round(totalUsers * 0.16) },
      { channel: "Referral (Naver)", sessions: Math.round(totalUsers * 0.09) },
    ],
  };
}

/* ============================ 소재함 (Drive) ============================ */
export type DemoDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

export function demoDriveFiles(folderId: string): DemoDriveFile[] {
  if (folderId === "demo-root" || folderId === "") {
    return [
      { id: "demo-folder-insta", name: "01_인스타그램", mimeType: FOLDER_MIME, modifiedTime: daysAgo(1) },
      { id: "demo-folder-blog", name: "02_네이버블로그", mimeType: FOLDER_MIME, modifiedTime: daysAgo(2) },
      { id: "demo-folder-reels", name: "03_릴스영상", mimeType: FOLDER_MIME, modifiedTime: daysAgo(3) },
      { id: "demo-folder-logo", name: "04_로고_브랜딩", mimeType: FOLDER_MIME, modifiedTime: daysAgo(10) },
      { id: "demo-file-r1", name: "메뉴판_2026.pdf", mimeType: "application/pdf", size: "842000", modifiedTime: daysAgo(4), webViewLink: "#" },
    ];
  }
  if (folderId === "demo-folder-insta") {
    return [
      { id: "demo-img-1", name: "딸기케이크_피드.jpg", mimeType: "image/jpeg", size: "1840000", modifiedTime: daysAgo(1), webViewLink: "#" },
      { id: "demo-img-2", name: "흑임자라떼_감성컷.jpg", mimeType: "image/jpeg", size: "2120000", modifiedTime: daysAgo(1), webViewLink: "#" },
      { id: "demo-img-3", name: "매장외관_저녁.png", mimeType: "image/png", size: "3050000", modifiedTime: daysAgo(2), webViewLink: "#" },
      { id: "demo-img-4", name: "브런치세트_카드뉴스.png", mimeType: "image/png", size: "1520000", modifiedTime: daysAgo(3), webViewLink: "#" },
    ];
  }
  if (folderId === "demo-folder-reels") {
    return [
      { id: "demo-vid-1", name: "라떼아트_과정.mp4", mimeType: "video/mp4", size: "18400000", modifiedTime: daysAgo(3), webViewLink: "#" },
      { id: "demo-vid-2", name: "매장_브이로그.mp4", mimeType: "video/mp4", size: "42100000", modifiedTime: daysAgo(5), webViewLink: "#" },
    ];
  }
  if (folderId === "demo-folder-blog") {
    return [
      { id: "demo-doc-1", name: "방문후기_초안.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: "62000", modifiedTime: daysAgo(2), webViewLink: "#" },
      { id: "demo-img-5", name: "블로그_썸네일.jpg", mimeType: "image/jpeg", size: "980000", modifiedTime: daysAgo(2), webViewLink: "#" },
    ];
  }
  if (folderId === "demo-folder-logo") {
    return [
      { id: "demo-img-6", name: "로이어드_로고_main.png", mimeType: "image/png", size: "240000", modifiedTime: daysAgo(10), webViewLink: "#" },
      { id: "demo-img-7", name: "로이어드_로고_white.png", mimeType: "image/png", size: "210000", modifiedTime: daysAgo(10), webViewLink: "#" },
    ];
  }
  return [];
}

/* ============================ 쓰레드봇 ============================ */
export type DemoFeedPost = {
  id: string;
  platform: "threads" | "instagram";
  username: string;
  avatarColor: string;
  text: string;
  likes: number;
  comments: number;
  postedAgo: string;
  planned: "like_reply" | "skip" | null;
  planReason: string;
};

export type DemoThreadAccount = {
  platform: "threads" | "instagram";
  username: string | null;
  status: "connected" | "expired" | "disconnected" | "needs_business";
  expiresInDays: number | null;
};

export function demoThreadbotRules(): ThreadbotRules {
  return {
    storeCode: DEMO_STORE_CODE,
    botEnabled: true,
    dryRun: true,
    enableLike: true,
    enableReply: true,
    dailyLikeLimit: 20,
    dailyReplyLimit: 10,
    runIntervalMinutes: 120,
    activeHoursStart: "09:00",
    activeHoursEnd: "23:00",
    keywordsInclude: ["카페", "디저트", "브런치", "일상"],
    keywordsExclude: ["광고", "홍보", "이벤트", "당첨"],
    tone: "friendly",
    minPostLength: 15,
    aiModel: "gemini-2.5-flash",
    lastRunAt: minsAgo(34),
  };
}

export function demoThreadbotSummary(): ThreadbotSummary {
  return { likes: 12, replies: 5, skips: 8, errors: 1 };
}

export function demoThreadbotActivity(): ThreadbotActivity[] {
  return [
    {
      id: "demo-act-1",
      platform: "threads",
      action: "reply",
      targetUsername: "@morning_runner",
      postId: "p-101",
      postPreview: "오늘 아침 러닝 완료! 한강 바람이 진짜 최고였어요 🏃",
      replyText: "와 아침 러닝 부지런하시네요! 한강 바람 상상만 해도 상쾌해요 :)",
      aiReason: "일상·운동 공감 적합",
      status: "dry_run",
      createdAt: minsAgo(6),
    },
    {
      id: "demo-act-2",
      platform: "threads",
      action: "like",
      targetUsername: "@cafe_daily",
      postId: "p-102",
      postPreview: "흑임자 라떼 신메뉴 내봤는데 반응이 좋네요 ☕",
      replyText: null,
      aiReason: "카페·디저트 키워드 일치",
      status: "dry_run",
      createdAt: minsAgo(14),
    },
    {
      id: "demo-act-3",
      platform: "threads",
      action: "skip",
      targetUsername: "@promo_event_kr",
      postId: "p-103",
      postPreview: "★초특가★ 지금 구매하면 50% 할인 이벤트 당첨!!",
      replyText: null,
      aiReason: "제외 키워드(광고·이벤트·당첨) 감지 → 스킵",
      status: "success",
      createdAt: minsAgo(21),
    },
    {
      id: "demo-act-4",
      platform: "instagram",
      action: "reply",
      targetUsername: "@brunch_lover",
      postId: "p-104",
      postPreview: "주말 브런치 세트 다녀왔어요. 플레이팅 미쳤다…",
      replyText: "플레이팅 진짜 예쁘네요! 주말 브런치 분위기 너무 좋아 보여요 👏",
      aiReason: "브런치 키워드 일치, 긍정 톤",
      status: "dry_run",
      createdAt: minsAgo(32),
    },
    {
      id: "demo-act-5",
      platform: "threads",
      action: "error",
      targetUsername: "@night_walk",
      postId: "p-105",
      postPreview: "야간 산책 중 사진 한 장",
      replyText: null,
      aiReason: "Threads API rate limit (429) — 재시도 예정",
      status: "failed",
      createdAt: minsAgo(48),
    },
    {
      id: "demo-act-6",
      platform: "threads",
      action: "like",
      targetUsername: "@dessert_diary",
      postId: "p-106",
      postPreview: "딸기 케이크 시즌 돌아왔다 🍓",
      replyText: null,
      aiReason: "디저트 키워드 일치",
      status: "dry_run",
      createdAt: minsAgo(63),
    },
  ];
}

export function demoThreadbotFeed(): DemoFeedPost[] {
  return [
    {
      id: "p-201",
      platform: "threads",
      username: "@seoul_foodie",
      avatarColor: "#f59e0b",
      text: "오늘 점심으로 먹은 들기름 막국수 인생 맛집 찾음… 이 동네 사시는 분들 꼭 가보세요!",
      likes: 41,
      comments: 7,
      postedAgo: "12분 전",
      planned: "like_reply",
      planReason: "맛집·일상 키워드 일치",
    },
    {
      id: "p-202",
      platform: "threads",
      username: "@cafe_hopping",
      avatarColor: "#10b981",
      text: "주말마다 카페 투어 다니는데 오늘 간 곳 디저트가 너무 예뻐서 사진 백장 찍음 ☕🍰",
      likes: 88,
      comments: 15,
      postedAgo: "27분 전",
      planned: "like_reply",
      planReason: "카페·디저트 키워드 일치",
    },
    {
      id: "p-203",
      platform: "instagram",
      username: "@daily_brunch",
      avatarColor: "#8b5cf6",
      text: "브런치 플레이트 완성! 에그 베네딕트 처음 만들어봤는데 성공적 🍳",
      likes: 132,
      comments: 9,
      postedAgo: "41분 전",
      planned: "like_reply",
      planReason: "브런치 키워드 일치",
    },
    {
      id: "p-204",
      platform: "threads",
      username: "@bigsale_official",
      avatarColor: "#ef4444",
      text: "🔥대박 이벤트🔥 지금 팔로우하고 댓글 남기면 추첨 통해 경품 당첨! 광고 문의 DM",
      likes: 5,
      comments: 120,
      postedAgo: "55분 전",
      planned: "skip",
      planReason: "제외 키워드(이벤트·당첨·광고) → 스킵",
    },
    {
      id: "p-205",
      platform: "threads",
      username: "@slow_life_kim",
      avatarColor: "#3b82f6",
      text: "퇴근하고 동네 한 바퀴 산책. 저녁 공기가 선선해서 기분이 좋다 🌙",
      likes: 23,
      comments: 2,
      postedAgo: "1시간 전",
      planned: "like_reply",
      planReason: "일상 공감 적합",
    },
  ];
}

export function demoThreadbotAccounts(): DemoThreadAccount[] {
  return [
    { platform: "threads", username: "@loyad_official", status: "connected", expiresInDays: 28 },
    { platform: "instagram", username: null, status: "needs_business", expiresInDays: null },
  ];
}
