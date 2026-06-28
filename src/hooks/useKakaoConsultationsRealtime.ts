// filepath: src/hooks/useKakaoConsultationsRealtime.ts
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listConsultationsFn, type Consultation, type ConsultMessage } from "@/lib/kakaoConsult.functions";

type Options = {
  storeCode?: string;
  notify?: boolean;
  onNewMessage?: (msg: ConsultMessage) => void;
};

/** Neon — 5초 폴링 (Supabase Realtime 대체) */
export function useKakaoConsultationsRealtime(
  initial: Consultation[] = [],
  options: Options = {},
) {
  const { storeCode, notify = true } = options;
  const listConsultations = useServerFn(listConsultationsFn);
  const [consultations, setConsultations] = useState<Consultation[]>(initial);
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setConsultations(initial);
  }, [initial]);

  useEffect(() => {
    if (!storeCode) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await listConsultations({ data: { storeCode } });
        if (cancelled) return;
        const next = res.consultations;
        if (notify) {
          for (const c of next) {
            if (!prevIdsRef.current.has(c.id)) {
              prevIdsRef.current.add(c.id);
              if (prevIdsRef.current.size > 1) {
                toast.message("새 카카오 상담", {
                  description: `${c.customerName ?? "고객"}: ${c.lastMessage ?? ""}`,
                });
              }
            }
          }
        }
        setConsultations(next);
      } catch (e) {
        console.error("[useKakaoConsultationsRealtime] poll failed:", e);
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [storeCode, notify, listConsultations]);

  const unreadTotal = consultations.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

  return { consultations, setConsultations, unreadTotal };
}
