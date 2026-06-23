// filepath: src/components/SetupBanner.tsx
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Settings, X } from "lucide-react";
import { getPlatformSetupStatusFn } from "@/lib/platformSecrets.functions";

type Props = {
  onOpenSettings: () => void;
};

export function SetupBanner({ onOpenSettings }: Props) {
  const getStatus = useServerFn(getPlatformSetupStatusFn);
  const [dismissed, setDismissed] = useState(false);
  const [percent, setPercent] = useState(100);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    void getStatus()
      .then((s) => {
        setPercent(s.percentComplete);
        setReady(s.readyForPublish);
      })
      .catch(() => {});
  }, [getStatus]);

  if (dismissed || ready || percent >= 85) return null;

  return (
    <div className="mx-5 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
      <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          설정이 {percent}%만 완료되었습니다
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          AI 생성·소셜 발행을 쓰려면 설정 마법사에서 API 키를 입력해 주세요. (약 10분)
        </p>
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <Settings className="size-3.5" />
          설정 마법사 열기
        </button>
      </div>
      <button type="button" onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
