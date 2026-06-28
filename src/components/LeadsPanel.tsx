import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listLeadsFn, updateLeadFn, type LeadRow } from "@/lib/leads.functions";
import { Loader2, Phone, Store, RefreshCw, Inbox, MessageCircle, FileText } from "lucide-react";
import { KakaoConsultPanel } from "@/components/KakaoConsultPanel";

type LeadsProps = { storeCode?: string; storeName?: string };

export function LeadsPanel({ storeCode, storeName }: LeadsProps) {
  const [view, setView] = useState<"kakao" | "landing">("kakao");

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-secondary/50">
      <div className="px-6 pt-4 bg-card border-b border-border flex items-center gap-1">
        <button
          onClick={() => setView("kakao")}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            view === "kakao"
              ? "border-brand text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageCircle className="size-4" /> 카카오 상담
        </button>
        <button
          onClick={() => setView("landing")}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            view === "landing"
              ? "border-brand text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="size-4" /> 랜딩 상담
        </button>
      </div>
      {view === "kakao" ? (
        <KakaoConsultPanel storeCode={storeCode} storeName={storeName} />
      ) : (
        <LandingLeadsView />
      )}
    </div>
  );
}

type Lead = LeadRow;

const STATUS_META = {
  new: { label: "신규", cls: "bg-accent-gradient text-accent-foreground" },
  contacted: { label: "연락중", cls: "bg-brand text-primary-foreground" },
  converted: { label: "전환", cls: "bg-emerald-600 text-white" },
  dropped: { label: "보류", cls: "bg-muted text-muted-foreground" },
} as const;

const STATUSES: Lead["status"][] = ["new", "contacted", "converted", "dropped"];

function LandingLeadsView() {
  const listLeads = useServerFn(listLeadsFn);
  const updateLead = useServerFn(updateLeadFn);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Lead["status"]>("all");
  const [error, setError] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listLeads({ data: {} });
      setLeads(res.leads);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [listLeads]);

  const updateStatus = async (id: string, status: Lead["status"]) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await updateLead({ data: { id, status } });
    } catch {
      void load();
    }
  };

  const visible = leads.filter((l) => filter === "all" || l.status === filter);
  const counts = STATUSES.reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s]: leads.filter((l) => l.status === s).length }),
    { all: leads.length },
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-secondary/50">
      <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">상담 리드</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            랜딩페이지에서 접수된 도입 상담 신청 내역
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-2 overflow-x-auto">
        {(["all", ...STATUSES] as const).map((s) => {
          const active = filter === s;
          const label = s === "all" ? "전체" : STATUS_META[s].label;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-medium transition ${
                active
                  ? "bg-brand text-primary-foreground shadow-soft"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span
                className={`text-[10px] px-1.5 rounded-full ${
                  active ? "bg-white/20" : "bg-card border border-border"
                }`}
              >
                {counts[s] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm text-accent">
            {error}
          </div>
        )}

        {loading && leads.length === 0 ? (
          <div className="h-64 grid place-items-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="h-64 grid place-items-center text-muted-foreground">
            <div className="text-center">
              <Inbox className="size-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">표시할 리드가 없습니다.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {visible.map((l) => {
              const meta = STATUS_META[l.status];
              return (
                <article
                  key={l.id}
                  className="bg-card border border-border rounded-2xl p-5 shadow-soft hover:shadow-card transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-semibold text-base">{l.name}</h3>
                        <span
                          className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                        {l.industry && (
                          <span className="text-[10px] rounded-full px-2 py-0.5 bg-secondary text-muted-foreground border border-border">
                            {l.industry}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3" />
                          <a href={`tel:${l.phone}`} className="hover:text-foreground">
                            {l.phone}
                          </a>
                        </span>
                        {l.store_name && (
                          <span className="inline-flex items-center gap-1">
                            <Store className="size-3" /> {l.store_name}
                          </span>
                        )}
                        <span className="text-muted-foreground/70">
                          {new Date(l.created_at).toLocaleString("ko-KR", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {l.message && (
                        <p className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                          {l.message}
                        </p>
                      )}
                    </div>
                    <select
                      value={l.status}
                      onChange={(e) => void updateStatus(l.id, e.target.value as Lead["status"])}
                      className="shrink-0 h-8 px-2 rounded-lg bg-secondary border border-border text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
