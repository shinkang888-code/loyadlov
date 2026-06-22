// filepath: src/components/BulkGenerateDialog.tsx
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { enqueueBulkGenerationFn } from "@/lib/generation.functions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles, Layers, Bot, ImageIcon } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeCode?: string;
  storeName: string;
  industry: string;
  tone: string[];
  onEnqueued?: () => void;
};

export function BulkGenerateDialog({
  open,
  onOpenChange,
  storeCode,
  storeName,
  industry,
  tone,
  onEnqueued,
}: Props) {
  const enqueue = useServerFn(enqueueBulkGenerationFn);
  const [keyword, setKeyword] = useState("오늘의 메뉴");
  const [variantCount, setVariantCount] = useState(5);
  const [includeImages, setIncludeImages] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const { job } = await enqueue({
        data: {
          storeCode,
          store: storeName,
          industry,
          tone,
          keyword,
          variantCount,
          includeImages,
          channel: "instagram",
        },
      });
      toast.success("대량 생성 작업이 큐에 등록되었습니다", {
        description: `${variantCount}개 변형 · Realtime으로 진행률이 업데이트됩니다.`,
      });
      onEnqueued?.();
      onOpenChange(false);
      console.info("[bulk-gen] job enqueued", job.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-crimson" />
            AI 대량 생성 (비동기 큐)
          </DialogTitle>
          <DialogDescription>
            본문·해시태그·이미지를 {variantCount}조합 한 번에 생성합니다. Postgres 작업 큐 + Realtime으로
            진행 상황을 실시간 확인할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-border bg-secondary/50 p-3">
              <Bot className="size-4 mx-auto text-primary mb-1" />
              <div className="text-[10px] font-semibold">Gemini Flash</div>
              <div className="text-[10px] text-muted-foreground">본문+태그</div>
            </div>
            <div className="rounded-xl border border-border bg-secondary/50 p-3">
              <ImageIcon className="size-4 mx-auto text-crimson mb-1" />
              <div className="text-[10px] font-semibold">GPT Image</div>
              <div className="text-[10px] text-muted-foreground">비주얼</div>
            </div>
            <div className="rounded-xl border border-border bg-secondary/50 p-3">
              <Layers className="size-4 mx-auto text-foreground/70 mb-1" />
              <div className="text-[10px] font-semibold">Job Queue</div>
              <div className="text-[10px] text-muted-foreground">Realtime</div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="bulk-keyword">핵심 키워드</Label>
            <Input
              id="bulk-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: 신메뉴 출시, 주말 한정"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="bulk-count">변형 개수 (1~8)</Label>
            <Input
              id="bulk-count"
              type="number"
              min={1}
              max={8}
              value={variantCount}
              onChange={(e) => setVariantCount(Math.min(8, Math.max(1, Number(e.target.value) || 5)))}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <div className="text-sm font-medium">이미지 포함</div>
              <div className="text-[11px] text-muted-foreground">각 변형마다 AI 이미지 생성</div>
            </div>
            <Switch checked={includeImages} onCheckedChange={setIncludeImages} />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            취소
          </Button>
          <Button onClick={() => void submit()} disabled={loading || !keyword.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Sparkles className="size-4 mr-1.5" />}
            {loading ? "등록 중…" : "큐에 등록"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
