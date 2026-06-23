// filepath: src/hooks/useThreadbotActivityRealtime.ts
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ThreadbotActivity } from "@/lib/threadbot.functions";
import { toast } from "sonner";

type ActivityRow = {
  id: string;
  store_code: string;
  platform: string;
  action: string;
  target_username: string | null;
  post_id: string | null;
  post_preview: string | null;
  reply_text: string | null;
  ai_reason: string | null;
  status: string;
  created_at: string;
};

function mapRow(row: ActivityRow): ThreadbotActivity {
  return {
    id: row.id,
    platform: (row.platform as ThreadbotActivity["platform"]) ?? "threads",
    action: row.action as ThreadbotActivity["action"],
    targetUsername: row.target_username,
    postId: row.post_id,
    postPreview: row.post_preview,
    replyText: row.reply_text,
    aiReason: row.ai_reason,
    status: (row.status as ThreadbotActivity["status"]) ?? "success",
    createdAt: row.created_at,
  };
}

const ACTION_LABEL: Record<string, string> = {
  like: "공감",
  reply: "댓글",
  skip: "스킵",
  error: "오류",
};

type Options = { storeCode?: string; notify?: boolean };

export function useThreadbotActivityRealtime(
  initial: ThreadbotActivity[] = [],
  options: Options = {}
) {
  const { storeCode, notify = false } = options;
  const [items, setItems] = useState<ThreadbotActivity[]>(initial);
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2));

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    if (!storeCode) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`threadbot_activity:${storeCode}:${instanceIdRef.current}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "threadbot_activity_logs",
            filter: `store_code=eq.${storeCode}`,
          },
          (payload) => {
            const row = payload.new as ActivityRow | undefined;
            if (!row?.id) return;
            const item = mapRow(row);
            setItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 100));
            if (notify && item.action === "reply" && item.replyText) {
              toast.success(`${ACTION_LABEL[item.action]} 게시`, {
                description: `${item.targetUsername ?? ""} · ${item.replyText.slice(0, 30)}`,
              });
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.error("[useThreadbotActivityRealtime] subscribe failed:", e);
    }
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [storeCode, notify]);

  return { items, setItems };
}
