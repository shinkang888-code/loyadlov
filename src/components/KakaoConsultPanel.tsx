// filepath: src/components/KakaoConsultPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  MessageCircle,
  RefreshCw,
  Settings,
  ExternalLink,
  Bot,
  Send,
  Trash2,
  Check,
  Pencil,
  Loader2,
  Inbox,
  Search,
  X,
} from "lucide-react";
import {
  getKakaoSettingsFn,
  listConsultationsFn,
  getConsultMessagesFn,
  renameConsultationFn,
  updateConsultationFn,
  markConsultationReadFn,
  deleteConsultationFn,
  sendConsultMessageFn,
  type Consultation,
  type ConsultMessage,
  type KakaoSettings,
} from "@/lib/kakaoConsult.functions";
import { useKakaoConsultationsRealtime } from "@/hooks/useKakaoConsultationsRealtime";
import { KakaoSettingsDialog } from "@/components/KakaoSettingsDialog";

type Props = { storeCode?: string; storeName?: string };

const STATUS_META: Record<Consultation["status"], { label: string; cls: string; dot: string }> = {
  new: { label: "신규", cls: "bg-accent-gradient text-accent-foreground", dot: "bg-accent" },
  active: { label: "진행중", cls: "bg-brand text-primary-foreground", dot: "bg-primary" },
  pending: { label: "대기", cls: "bg-amber-500 text-white", dot: "bg-amber-500" },
  closed: { label: "완료", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};
const STATUSES: Consultation["status"][] = ["new", "active", "pending", "closed"];

function openPopup(url: string, name: string) {
  if (!url) {
    toast.error("URL이 설정되지 않았습니다. 설정에서 먼저 입력하세요.");
    return;
  }
  window.open(url, name, "noopener,noreferrer,width=480,height=720");
}

export function KakaoConsultPanel({ storeCode, storeName }: Props) {
  const getSettings = useServerFn(getKakaoSettingsFn);
  const listFn = useServerFn(listConsultationsFn);
  const getMessages = useServerFn(getConsultMessagesFn);
  const renameFn = useServerFn(renameConsultationFn);
  const updateFn = useServerFn(updateConsultationFn);
  const markReadFn = useServerFn(markConsultationReadFn);
  const deleteFn = useServerFn(deleteConsultationFn);
  const sendFn = useServerFn(sendConsultMessageFn);

  const [settings, setSettings] = useState<KakaoSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [seed, setSeed] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Consultation["status"]>("all");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConsultMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const threadRef = useRef<HTMLDivElement>(null);

  const onNewMessage = useCallback(
    (msg: ConsultMessage) => {
      if (msg.consultationId === selectedId) {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );
      }
    },
    [selectedId]
  );

  const { consultations, unreadTotal } = useKakaoConsultationsRealtime(seed, {
    storeCode,
    notify: true,
    onNewMessage,
  });

  const loadSettings = useCallback(async () => {
    try {
      const res = await getSettings({ data: { storeCode } });
      setSettings(res.settings);
    } catch {
      /* noop */
    }
  }, [getSettings, storeCode]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFn({ data: { storeCode } });
      setSeed(res.consultations);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "상담 목록 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [listFn, storeCode]);

  useEffect(() => {
    void loadSettings();
    void loadList();
  }, [loadSettings, loadList]);

  const selected = useMemo(
    () => consultations.find((c) => c.id === selectedId) ?? null,
    [consultations, selectedId]
  );

  const openConsultation = useCallback(
    async (c: Consultation) => {
      setSelectedId(c.id);
      setEditingName(false);
      setMsgLoading(true);
      try {
        const res = await getMessages({ data: { consultationId: c.id } });
        setMessages(res.messages);
        if (c.unreadCount > 0) {
          void markReadFn({ data: { id: c.id } });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "대화 로딩 실패");
      } finally {
        setMsgLoading(false);
      }
    },
    [getMessages, markReadFn]
  );

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      const res = await sendFn({
        data: { storeCode, consultationId: selected.id, content: draft.trim() },
      });
      setMessages((prev) => [...prev, res.message]);
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "전송 실패");
    } finally {
      setSending(false);
    }
  };

  const handleRename = async () => {
    if (!selected) return;
    try {
      await renameFn({ data: { id: selected.id, name: nameInput.trim() } });
      setEditingName(false);
      void loadList();
      toast.success("이름이 수정되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "이름 수정 실패");
    }
  };

  const handleStatus = async (status: Consultation["status"]) => {
    if (!selected) return;
    try {
      await updateFn({ data: { id: selected.id, status } });
      void loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "상태 변경 실패");
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm("이 상담 기록을 삭제할까요? 메시지도 함께 삭제됩니다.")) return;
    try {
      await deleteFn({ data: { id: selected.id } });
      setSelectedId(null);
      setMessages([]);
      void loadList();
      toast.success("삭제되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const visible = consultations.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (c.customerName ?? "").toLowerCase().includes(q) ||
        (c.lastMessage ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = STATUSES.reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s]: consultations.filter((c) => c.status === s).length }),
    { all: consultations.length }
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <MessageCircle className="size-5 text-[#FEE500] fill-[#FEE500]" /> 카카오 상담
            {unreadTotal > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                안읽음 {unreadTotal}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {storeName ? `${storeName} · ` : ""}실시간 카카오톡 상담 인박스
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openPopup(settings?.channelChatUrl ?? "", "kakao-chat")}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#FEE500] text-[#3C1E1E] text-xs font-semibold hover:brightness-95 transition"
          >
            <ExternalLink className="size-3.5" /> 채팅방 열기
          </button>
          <button
            type="button"
            onClick={() => openPopup(settings?.chatbotManageUrl ?? "", "kakao-bot")}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition"
          >
            <Bot className="size-3.5" /> 챗봇 관리
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center justify-center size-9 rounded-xl border border-border hover:bg-secondary transition"
            title="설정"
          >
            <Settings className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void loadList()}
            className="inline-flex items-center justify-center size-9 rounded-xl border border-border hover:bg-secondary transition"
            title="새로고침"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 본문: 인박스 + 대화 */}
      <div className="flex-1 flex min-h-0">
        {/* 인박스 */}
        <div className="w-[320px] shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름·내용 검색"
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-secondary border border-border text-xs focus:outline-none"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {(["all", ...STATUSES] as const).map((s) => {
                const active = filter === s;
                const label = s === "all" ? "전체" : STATUS_META[s].label;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium transition ${
                      active
                        ? "bg-brand text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                    <span className="text-[9px]">{counts[s] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && consultations.length === 0 ? (
              <div className="h-40 grid place-items-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : visible.length === 0 ? (
              <div className="h-40 grid place-items-center text-muted-foreground text-center px-4">
                <div>
                  <Inbox className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">표시할 상담이 없습니다.</p>
                </div>
              </div>
            ) : (
              visible.map((c) => {
                const meta = STATUS_META[c.status];
                const isActive = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => void openConsultation(c)}
                    className={`w-full text-left px-4 py-3 border-b border-border/60 hover:bg-secondary/60 transition ${
                      isActive ? "bg-secondary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate flex items-center gap-1.5">
                        <span className={`size-1.5 rounded-full ${meta.dot}`} />
                        {c.customerName || "이름 없는 고객"}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {c.lastMessageAt
                          ? new Date(c.lastMessageAt).toLocaleString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {c.lastMessage || "(메시지 없음)"}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="shrink-0 text-[10px] font-bold min-w-4 h-4 px-1 grid place-items-center rounded-full bg-accent text-accent-foreground">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 대화 */}
        <div className="flex-1 flex flex-col min-w-0 bg-secondary/30">
          {!selected ? (
            <div className="flex-1 grid place-items-center text-muted-foreground text-center px-6">
              <div>
                <MessageCircle className="size-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">왼쪽에서 상담을 선택하세요.</p>
                <p className="text-xs mt-1 text-muted-foreground/70">
                  새 상담이 들어오면 실시간으로 목록에 표시되고 알림이 뜹니다.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 대화 헤더 */}
              <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex items-center gap-2">
                  {editingName ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && void handleRename()}
                        className="h-8 px-2 rounded-lg bg-secondary border border-border text-sm w-44"
                      />
                      <button
                        onClick={() => void handleRename()}
                        className="size-8 grid place-items-center rounded-lg bg-brand text-primary-foreground"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="size-8 grid place-items-center rounded-lg border border-border"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-display font-bold text-base truncate">
                        {selected.customerName || "이름 없는 고객"}
                      </h3>
                      <button
                        onClick={() => {
                          setNameInput(selected.customerName ?? "");
                          setEditingName(true);
                        }}
                        className="size-7 grid place-items-center rounded-lg hover:bg-secondary text-muted-foreground"
                        title="이름 수정"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selected.status}
                    onChange={(e) => void handleStatus(e.target.value as Consultation["status"])}
                    className="h-8 px-2 rounded-lg bg-secondary border border-border text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => openPopup(settings?.channelChatUrl ?? "", "kakao-chat")}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#FEE500] text-[#3C1E1E] text-xs font-semibold"
                    title="카카오 대화창 새창 열기"
                  >
                    <ExternalLink className="size-3.5" /> 카카오 대화
                  </button>
                  <button
                    onClick={() => void handleDelete()}
                    className="size-8 grid place-items-center rounded-lg border border-border text-rose-500 hover:bg-rose-500/10"
                    title="삭제"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {/* 메시지 스레드 */}
              <div ref={threadRef} className="flex-1 overflow-y-auto p-5 space-y-3">
                {msgLoading ? (
                  <div className="h-32 grid place-items-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">
                    아직 메시지가 없습니다.
                  </p>
                ) : (
                  messages.map((m) => {
                    const out = m.direction === "out";
                    return (
                      <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[72%]">
                          <div
                            className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                              out
                                ? "bg-brand text-primary-foreground rounded-br-md"
                                : "bg-card border border-border rounded-bl-md"
                            }`}
                          >
                            {m.content}
                          </div>
                          <div
                            className={`text-[10px] text-muted-foreground mt-1 ${
                              out ? "text-right" : "text-left"
                            }`}
                          >
                            {m.msgType === "auto" ? "봇 · " : m.msgType === "agent" ? "상담원 · " : ""}
                            {new Date(m.createdAt).toLocaleTimeString("ko-KR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 입력 */}
              <div className="p-3 border-t border-border bg-card">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    rows={1}
                    placeholder="답변 메시지 입력 (기록용) · Enter 전송"
                    className="flex-1 resize-none max-h-28 px-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={sending || !draft.trim()}
                    className="size-10 shrink-0 grid place-items-center rounded-xl bg-brand text-primary-foreground disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  여기 입력은 상담 기록으로 저장됩니다. 실제 고객 답장은 「카카오 대화」 새창에서 진행하세요.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <KakaoSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        storeCode={storeCode}
        settings={settings}
        onSaved={(s) => setSettings(s)}
      />
    </div>
  );
}
