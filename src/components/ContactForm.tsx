import { useState } from "react";
import { z } from "zod";
import { Send, Check, Loader2, AlertCircle } from "lucide-react";
import { submitContactFn } from "@/lib/leads.functions";

const schema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(80),
  phone: z
    .string()
    .trim()
    .min(6, "연락처를 정확히 입력해 주세요")
    .max(30)
    .regex(/^[0-9+\-\s()]+$/, "숫자와 -, +, 공백만 입력 가능합니다"),
  store_name: z.string().trim().max(120).optional().or(z.literal("")),
  industry: z.string().trim().max(60).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

type FormState = z.infer<typeof schema>;

const INDUSTRIES = ["요식업", "카페·베이커리", "뷰티·헤어", "헬스·필라테스", "리테일", "기타"];

export function ContactForm({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    store_name: "",
    industry: "",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [serverError, setServerError] = useState<string>("");

  const dark = variant === "dark";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setStatus("submitting");
    try {
      await submitContactFn({
        data: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          store_name: parsed.data.store_name || undefined,
          industry: parsed.data.industry || undefined,
          message: parsed.data.message || undefined,
          source: "landing",
        },
      });
    } catch {
      setStatus("error");
      setServerError("전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setStatus("done");
    setForm({ name: "", phone: "", store_name: "", industry: "", message: "" });
  };

  if (status === "done") {
    return (
      <div
        className={`rounded-3xl p-10 text-center border ${
          dark ? "bg-white/10 border-white/20 backdrop-blur text-white" : "bg-card border-border"
        }`}
      >
        <div className="mx-auto mb-4 size-14 rounded-full bg-accent-gradient grid place-items-center shadow-crimson">
          <Check className="size-7 text-accent-foreground" />
        </div>
        <h3 className="font-display text-2xl font-bold">상담 신청이 접수되었어요</h3>
        <p className={`mt-2 text-sm ${dark ? "text-white/75" : "text-muted-foreground"}`}>
          영업일 기준 24시간 내 전담 매니저가 연락드립니다.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className={`mt-6 inline-flex items-center text-sm underline-offset-4 hover:underline ${
            dark ? "text-white/80" : "text-muted-foreground"
          }`}
        >
          새 신청서 작성하기
        </button>
      </div>
    );
  }

  const inputBase = dark
    ? "w-full h-11 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/40 transition"
    : "w-full h-11 px-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition";

  const labelBase = dark ? "text-xs font-medium text-white/80" : "text-xs font-medium text-foreground/70";
  const errClass = "mt-1 text-xs text-accent flex items-center gap-1";

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-3xl p-7 md:p-8 border text-left ${
        dark ? "bg-white/10 border-white/20 backdrop-blur" : "bg-card border-border shadow-card"
      }`}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className={labelBase}>이름 *</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="홍길동"
            className={`mt-1.5 ${inputBase}`}
            maxLength={80}
          />
          {errors.name && (
            <span className={errClass}>
              <AlertCircle className="size-3" /> {errors.name}
            </span>
          )}
        </label>
        <label className="block">
          <span className={labelBase}>연락처 *</span>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="010-0000-0000"
            inputMode="tel"
            className={`mt-1.5 ${inputBase}`}
            maxLength={30}
          />
          {errors.phone && (
            <span className={errClass}>
              <AlertCircle className="size-3" /> {errors.phone}
            </span>
          )}
        </label>
        <label className="block">
          <span className={labelBase}>상호명</span>
          <input
            value={form.store_name}
            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
            placeholder="미나리삼겹살 성수점"
            className={`mt-1.5 ${inputBase}`}
            maxLength={120}
          />
        </label>
        <label className="block">
          <span className={labelBase}>업종</span>
          <select
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            className={`mt-1.5 ${inputBase} appearance-none`}
          >
            <option value="" className="text-foreground">선택해 주세요</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i} className="text-foreground">
                {i}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block mt-4">
        <span className={labelBase}>문의 내용</span>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="현재 운영 중인 채널, 도입 일정, 궁금한 점을 자유롭게 적어주세요."
          rows={4}
          className={`mt-1.5 ${inputBase} h-auto py-3 resize-none`}
          maxLength={2000}
        />
      </label>

      {serverError && (
        <div className="mt-4 flex items-center gap-2 text-xs text-accent">
          <AlertCircle className="size-3.5" /> {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-accent-gradient px-6 py-3.5 text-sm font-bold text-accent-foreground shadow-crimson hover:scale-[1.01] transition disabled:opacity-60 disabled:hover:scale-100"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="size-4 animate-spin" /> 전송 중...
          </>
        ) : (
          <>
            무료 상담 신청 <Send className="size-4" />
          </>
        )}
      </button>
      <p className={`mt-3 text-[11px] text-center ${dark ? "text-white/55" : "text-muted-foreground"}`}>
        제출 시 개인정보처리방침에 동의한 것으로 간주됩니다.
      </p>
    </form>
  );
}
