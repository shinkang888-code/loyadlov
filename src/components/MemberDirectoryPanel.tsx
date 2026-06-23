// filepath: src/components/MemberDirectoryPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users,
  RefreshCw,
  Search,
  Plus,
  Loader2,
  Mail,
  Phone,
  MessageCircle,
  Trash2,
  Pencil,
  Send,
  Inbox,
  Tag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMemberDirectoryFn,
  deleteMemberFn,
  getMemberThreadFn,
  sendMemberEmailFn,
  sendMemberKakaoFn,
  type CrmMember,
  type MemberMessage,
} from "@/lib/members.functions";
import {
  MemberFormDialog,
  ROLE_LABEL,
  STATUS_LABEL,
} from "@/components/MemberFormDialog";

type Props = { storeCode?: string; storeName?: string };

const ROLE_CLS: Record<string, string> = {
  member: "bg-secondary text-muted-foreground",
  vip: "bg-accent-gradient text-accent-foreground",
  staff: "bg-brand text-primary-foreground",
  manager: "bg-emerald-600 text-white",
  blocked: "bg-rose-600 text-white",
};

export function MemberDirectoryPanel({ storeCode, storeName }: Props) {
  const listFn = useServerFn(listMemberDirectoryFn);
  const deleteFn = useServerFn(deleteMemberFn);
  const getThread = useServerFn(getMemberThreadFn);
  const sendEmail = useServerFn(sendMemberEmailFn);
  const sendKakao = useServerFn(sendMemberKakaoFn);

  const [members, setMembers] = useState<CrmMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [thread, setThread] = useState<MemberMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [channel, setChannel] = useState<"email" | "kakao">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmMember | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef(Math.random().toString(36).slice(2));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFn({ data: { storeCode, search: search || undefined } });
      setMembers(res.members);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "회원 목록 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [listFn, storeCode, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => members.find((m) => m.id === selectedId) ?? null,
    [members, selectedId]
  );

  const openMember = useCallback(
    async (m: CrmMember) => {
      setSelectedId(m.id);
      setChannel(m.email ? "email" : "kakao");
      setSubject("");
      setBody("");
      setThreadLoading(true);
      try {
        const res = await getThread({ data: { memberId: m.id } });
        setThread(res.messages);
      } catch {
        setThread([]);
      } finally {
        setThreadLoading(false);
      }
    },
    [getThread]
  );

  // 수신 메시지 실시간 반영
  useEffect(() => {
    if (!storeCode) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`member_messages:${storeCode}:${instanceRef.current}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "member_messages",
            filter: `store_code=eq.${storeCode}`,
          },
          (payload) => {
            const r = payload.new as {
              id: string;
              member_id: string;
              channel: string;
              direction: string;
              subject: string | null;
              content: string | null;
              status: string;
              created_at: string;
            };
            if (r.direction === "in") {
              void load();
              if (r.member_id === selectedId) {
                setThread((prev) =>
                  prev.some((m) => m.id === r.id)
                    ? prev
                    : [
                        ...prev,
                        {
                          id: r.id,
                          memberId: r.member_id,
                          channel: r.channel as MemberMessage["channel"],
                          direction: "in",
                          subject: r.subject,
                          content: r.content,
                          status: r.status,
                          createdAt: r.created_at,
                        },
                      ]
                );
              } else {
                toast.message("새 메시지 수신", { description: r.subject ?? r.content ?? "" });
              }
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.error("[member_messages realtime]", e);
    }
    return () => {
      if (ch) void supabase.removeChannel(ch);
    };
  }, [storeCode, selectedId, load]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [thread]);

  const handleSend = async () => {
    if (!selected || !body.trim()) return;
    setSending(true);
    try {
      if (channel === "email") {
        if (!selected.email) {
          toast.error("이메일 주소가 없습니다. 회원 정보를 수정하세요.");
          return;
        }
        const res = await sendEmail({
          data: {
            storeCode,
            memberId: selected.id,
            subject: subject.trim() || "(제목 없음)",
            content: body.trim(),
          },
        });
        setThread((p) => [...p, res.message]);
        toast.success("이메일을 발송했습니다.");
      } else {
        const res = await sendKakao({
          data: { storeCode, memberId: selected.id, content: body.trim() },
        });
        setThread((p) => [...p, res.message]);
        toast.success("카카오 메시지를 기록했습니다.");
      }
      setBody("");
      setSubject("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "전송 실패");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`'${selected.name}' 회원을 삭제할까요? 통신 기록도 함께 삭제됩니다.`)) return;
    try {
      await deleteFn({ data: { id: selected.id } });
      setSelectedId(null);
      setThread([]);
      void load();
      toast.success("삭제되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Users className="size-5 text-primary" /> 회원
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {storeName ? `${storeName} · ` : ""}회원 {members.length}명 · 이메일/카카오 통합 관리
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-brand text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition"
          >
            <Plus className="size-3.5" /> 회원 등록
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center size-9 rounded-xl border border-border hover:bg-secondary transition"
            title="새로고침"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* 회원 목록 */}
        <div className="w-[300px] shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
              className="relative"
            >
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름·이메일·전화 검색"
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-secondary border border-border text-xs focus:outline-none"
              />
            </form>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && members.length === 0 ? (
              <div className="h-40 grid place-items-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <div className="h-40 grid place-items-center text-muted-foreground text-center px-4">
                <div>
                  <Inbox className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">등록된 회원이 없습니다.</p>
                </div>
              </div>
            ) : (
              members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => void openMember(m)}
                  className={`w-full text-left px-4 py-3 border-b border-border/60 hover:bg-secondary/60 transition ${
                    m.id === selectedId ? "bg-secondary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{m.name}</span>
                    <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${ROLE_CLS[m.role]}`}>
                      {ROLE_LABEL[m.role]}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {m.email || m.phone || "연락처 없음"}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 회원 상세 */}
        <div className="flex-1 flex flex-col min-w-0 bg-secondary/30">
          {!selected ? (
            <div className="flex-1 grid place-items-center text-muted-foreground text-center px-6">
              <div>
                <Users className="size-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">회원을 선택하면 정보와 이메일·카카오 대화가 표시됩니다.</p>
              </div>
            </div>
          ) : (
            <>
              {/* 프로필 헤더 */}
              <div className="px-5 py-4 border-b border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-bold text-base truncate">{selected.name}</h3>
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${ROLE_CLS[selected.role]}`}>
                        {ROLE_LABEL[selected.role]}
                      </span>
                      <span className="text-[10px] rounded-full px-2 py-0.5 bg-secondary text-muted-foreground border border-border">
                        {STATUS_LABEL[selected.status]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {selected.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3" /> {selected.email}
                        </span>
                      )}
                      {selected.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3" /> {selected.phone}
                        </span>
                      )}
                      {selected.kakaoUserKey && (
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="size-3" /> 카카오 연동
                        </span>
                      )}
                    </div>
                    {selected.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selected.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border"
                          >
                            <Tag className="size-2.5" /> {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {selected.memo && (
                      <p className="mt-2 text-xs text-foreground/70 whitespace-pre-wrap">{selected.memo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setEditing(selected);
                        setFormOpen(true);
                      }}
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-xs hover:bg-secondary"
                    >
                      <Pencil className="size-3.5" /> 수정
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
              </div>

              {/* 통신 스레드 */}
              <div ref={threadRef} className="flex-1 overflow-y-auto p-5 space-y-3">
                {threadLoading ? (
                  <div className="h-32 grid place-items-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : thread.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">
                    아직 주고받은 메시지가 없습니다. 아래에서 이메일/카카오를 보내보세요.
                  </p>
                ) : (
                  thread.map((m) => {
                    const out = m.direction === "out";
                    return (
                      <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[78%]">
                          <div
                            className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                              out
                                ? "bg-brand text-primary-foreground rounded-br-md"
                                : "bg-card border border-border rounded-bl-md"
                            }`}
                          >
                            {m.subject && (
                              <div className={`text-[11px] font-bold mb-1 ${out ? "text-primary-foreground/90" : ""}`}>
                                ✉ {m.subject}
                              </div>
                            )}
                            {m.content}
                          </div>
                          <div className={`text-[10px] text-muted-foreground mt-1 ${out ? "text-right" : "text-left"}`}>
                            {m.channel === "email" ? "이메일" : m.channel === "kakao" ? "카카오" : m.channel}
                            {m.status === "failed" ? " · 실패" : ""} ·{" "}
                            {new Date(m.createdAt).toLocaleString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
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

              {/* 컴포저 */}
              <div className="p-3 border-t border-border bg-card space-y-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setChannel("email")}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium ${
                      channel === "email" ? "bg-brand text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Mail className="size-3.5" /> 이메일
                  </button>
                  <button
                    onClick={() => setChannel("kakao")}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium ${
                      channel === "kakao" ? "bg-[#FEE500] text-[#3C1E1E]" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <MessageCircle className="size-3.5" /> 카카오
                  </button>
                </div>
                {channel === "email" && (
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="이메일 제목"
                    className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm focus:outline-none"
                  />
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={2}
                    placeholder={
                      channel === "email"
                        ? "이메일 본문 (실제 발송됩니다)"
                        : "카카오 메시지 (기록 저장)"
                    }
                    className="flex-1 resize-none max-h-32 px-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={sending || !body.trim()}
                    className="size-10 shrink-0 grid place-items-center rounded-xl bg-brand text-primary-foreground disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </div>
                {channel === "kakao" && (
                  <p className="text-[10px] text-muted-foreground">
                    카카오 직접 발송은 채널 정책상 제한됩니다. 기록 후 실제 답장은 「카카오 상담」 탭의 대화창에서 진행하세요.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <MemberFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        storeCode={storeCode}
        member={editing}
        onSaved={() => void load()}
      />
    </div>
  );
}
