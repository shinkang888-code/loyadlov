// filepath: src/hooks/useUnifiedTimeline.ts
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listUnifiedTimelineFn,
  type TimelineEvent,
} from "@/lib/timeline.functions";

type Options = {
  storeCode?: string;
  limit?: number;
  pollMs?: number;
  enabled?: boolean;
};

/** 통합 타임라인 — ServerFn 폴링 (Neon Realtime 대체, SSE fallback 준비) */
export function useUnifiedTimeline(options: Options = {}) {
  const { storeCode, limit = 40, pollMs = 4000, enabled = true } = options;
  const listTimeline = useServerFn(listUnifiedTimelineFn);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !storeCode) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const res = await listTimeline({ data: { storeCode, limit } });
        if (cancelled) return;
        setEvents(res.events);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "타임라인 로드 실패");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const id = setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [storeCode, limit, pollMs, enabled, listTimeline]);

  return { events, loading, error };
}
