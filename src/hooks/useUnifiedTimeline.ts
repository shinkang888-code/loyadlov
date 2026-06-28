// filepath: src/hooks/useUnifiedTimeline.ts
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listUnifiedTimelineFn,
  type TimelineEvent,
} from "@/lib/timeline.functions";

type Options = {
  storeCode?: string;
  limit?: number;
  pollMs?: number;
  enabled?: boolean;
  preferSse?: boolean;
};

/** 통합 타임라인 — SSE 우선, 실패 시 ServerFn 폴링 */
export function useUnifiedTimeline(options: Options = {}) {
  const {
    storeCode,
    limit = 40,
    pollMs = 4000,
    enabled = true,
    preferSse = true,
  } = options;
  const listTimeline = useServerFn(listUnifiedTimelineFn);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transport, setTransport] = useState<"sse" | "poll">("poll");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !storeCode) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;

    const loadPoll = async () => {
      try {
        const res = await listTimeline({ data: { storeCode, limit } });
        if (cancelled) return;
        setEvents(res.events);
        setError(null);
        setTransport("poll");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "타임라인 로드 실패");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const startPoll = () => {
      if (pollRef.current) return;
      void loadPoll();
      pollRef.current = setInterval(() => void loadPoll(), pollMs);
      setTransport("poll");
    };

    const connectSse = async () => {
      if (!preferSse || typeof EventSource === "undefined") {
        startPoll();
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          startPoll();
          return;
        }
        const url = `/api/timeline/stream?store=${encodeURIComponent(storeCode)}&token=${encodeURIComponent(token)}`;
        es = new EventSource(url);
        es.addEventListener("timeline", (ev) => {
          try {
            const payload = JSON.parse((ev as MessageEvent).data) as {
              events?: TimelineEvent[];
            };
            if (payload.events) {
              setEvents(payload.events.slice(0, limit));
              setError(null);
              setLoading(false);
              setTransport("sse");
            }
          } catch {
            /* ignore malformed */
          }
        });
        es.addEventListener("error", () => {
          es?.close();
          es = null;
          if (!cancelled) startPoll();
        });
      } catch {
        startPoll();
      }
    };

    void connectSse();

    return () => {
      cancelled = true;
      es?.close();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [storeCode, limit, pollMs, enabled, preferSse, listTimeline]);

  return { events, loading, error, transport };
}
