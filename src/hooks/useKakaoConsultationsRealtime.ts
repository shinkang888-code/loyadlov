// filepath: src/hooks/useKakaoConsultationsRealtime.ts
// 카카오 상담 세션/메시지 실시간 구독.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Consultation, ConsultMessage } from "@/lib/kakaoConsult.functions";

type ConsultRow = {
  id: string;
  store_code: string;
  kakao_user_key: string;
  customer_name: string | null;
  status: string;
  channel: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type MsgRow = {
  id: string;
  consultation_id: string;
  direction: string;
  content: string | null;
  msg_type: string;
  created_at: string;
};

function mapConsult(r: ConsultRow): Consultation {
  return {
    id: r.id,
    storeCode: r.store_code,
    kakaoUserKey: r.kakao_user_key,
    customerName: r.customer_name,
    status: r.status as Consultation["status"],
    channel: r.channel,
    lastMessage: r.last_message,
    lastMessageAt: r.last_message_at,
    unreadCount: r.unread_count,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

type Options = {
  storeCode?: string;
  notify?: boolean;
  onNewMessage?: (msg: ConsultMessage) => void;
};

export function useKakaoConsultationsRealtime(
  initial: Consultation[] = [],
  options: Options = {}
) {
  const { storeCode, notify = true, onNewMessage } = options;
  const [consultations, setConsultations] = useState<Consultation[]>(initial);
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  useEffect(() => {
    setConsultations(initial);
  }, [initial]);

  useEffect(() => {
    if (!storeCode) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`kakao_consult:${storeCode}:${instanceIdRef.current}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "kakao_consultations",
            filter: `store_code=eq.${storeCode}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const old = payload.old as ConsultRow | undefined;
              if (old?.id) setConsultations((prev) => prev.filter((c) => c.id !== old.id));
              return;
            }
            const row = payload.new as ConsultRow | undefined;
            if (!row?.id) return;
            const c = mapConsult(row);
            setConsultations((prev) => {
              const idx = prev.findIndex((x) => x.id === c.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = c;
                next.sort(
                  (a, b) =>
                    new Date(b.lastMessageAt ?? b.createdAt).getTime() -
                    new Date(a.lastMessageAt ?? a.createdAt).getTime()
                );
                return next;
              }
              if (notify && payload.eventType === "INSERT") {
                toast.message("새 카카오 상담", {
                  description: `${c.customerName ?? "고객"}: ${c.lastMessage ?? ""}`,
                });
              }
              return [c, ...prev];
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "kakao_messages",
            filter: `store_code=eq.${storeCode}`,
          },
          (payload) => {
            const row = payload.new as MsgRow | undefined;
            if (!row?.id) return;
            const msg: ConsultMessage = {
              id: row.id,
              consultationId: row.consultation_id,
              direction: row.direction as "in" | "out",
              content: row.content,
              msgType: row.msg_type,
              createdAt: row.created_at,
            };
            onNewMessageRef.current?.(msg);
          }
        )
        .subscribe();
    } catch (e) {
      console.error("[useKakaoConsultationsRealtime] subscribe failed:", e);
    }
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [storeCode, notify]);

  const unreadTotal = consultations.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

  return { consultations, setConsultations, unreadTotal };
}
