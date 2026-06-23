// filepath: src/components/PanelErrorBoundary.tsx
import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  children: ReactNode;
  /** 라벨 (어떤 영역인지) */
  label?: string;
};

type State = { error: Error | null };

/**
 * 패널 단위 에러 바운더리.
 * 대시보드의 특정 패널 렌더가 실패해도 사이드바/상단바는 유지하고,
 * 해당 영역만 인라인 에러 + "다시 시도"를 보여줘 전역 크래시(빈 에러페이지)를 방지한다.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[PanelErrorBoundary]", error);
    try {
      reportLovableError(error, { boundary: "panel_error_boundary" });
    } catch {
      /* noop */
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 grid place-items-center p-8">
          <div className="max-w-md text-center space-y-3">
            <div className="size-12 rounded-2xl bg-destructive/10 grid place-items-center mx-auto">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {this.props.label ?? "이 영역"}을 불러오지 못했습니다
            </h2>
            <p className="text-xs text-muted-foreground break-words">
              {this.state.error.message || "일시적인 오류가 발생했습니다."}
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition"
            >
              <RefreshCw className="size-3.5" />
              다시 시도
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
