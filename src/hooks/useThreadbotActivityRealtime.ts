// filepath: src/hooks/useThreadbotActivityRealtime.ts
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listThreadbotActivityFn, type ThreadbotActivity } from "@/lib/threadbot.functions";
import { toast } from "sonner";

const ACTION_LABEL: Record<string, string> = {
  like: "공감",
  reply: "댓글",
  skip: "스킵",
  error: "오류",
};

type Options = { storeCode?: string; notify?: boolean };

/** Neon — 5초 폴링 (Supabase Realtime 대체) */
export function useThreadbotActivityRealtime(
  initial: ThreadbotActivity[] = [],
  options: Options = {},
) {
  const { storeCode, notify = false } = options;
  const listActivity = useServerFn(listThreadbotActivityFn);
  const [items, setItems] = useState<ThreadbotActivity[]>(initial);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    if (!storeCode) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await listActivity({ data: { storeCode, limit: 100 } });
        if (cancelled) return;
        setItems(res.items);
        if (notify && res.items[0]?.action === "reply" && res.items[0]?.replyText) {
          const item = res.items[0];
          toast.success(`${ACTION_LABEL[item.action]} 게시`, {
            description: `${item.targetUsername ?? ""} · ${item.replyText?.slice(0, 30) ?? ""}`,
          });
        }
      } catch (e) {
        console.error("[useThreadbotActivityRealtime] poll failed:", e);
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [storeCode, notify, listActivity]);

  return { items, setItems };
}
