// filepath: src/components/MemberFormDialog.tsx
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Loader2, Save } from "lucide-react";
import {
  createMemberFn,
  updateMemberFn,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  type CrmMember,
  type MemberRoleType,
  type MemberStatusType,
} from "@/lib/members.functions";
import { isDemoStore, DEMO_STORE_CODE } from "@/lib/demoData";

export const ROLE_LABEL: Record<MemberRoleType, string> = {
  member: "일반회원",
  vip: "VIP",
  staff: "직원",
  manager: "매니저",
  blocked: "차단",
};
export const STATUS_LABEL: Record<MemberStatusType, string> = {
  active: "활성",
  inactive: "비활성",
  lead: "잠재(리드)",
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeCode?: string;
  member: CrmMember | null; // null = 신규
  onSaved: (m: CrmMember) => void;
};

const inputCls =
  "w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function MemberFormDialog({ open, onOpenChange, storeCode, member, onSaved }: Props) {
  const createFn = useServerFn(createMemberFn);
  const updateFn = useServerFn(updateMemberFn);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [kakaoUserKey, setKakaoUserKey] = useState("");
  const [role, setRole] = useState<MemberRoleType>("member");
  const [status, setStatus] = useState<MemberStatusType>("active");
  const [tags, setTags] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(member?.name ?? "");
    setEmail(member?.email ?? "");
    setPhone(member?.phone ?? "");
    setKakaoUserKey(member?.kakaoUserKey ?? "");
    setRole(member?.role ?? "member");
    setStatus(member?.status ?? "active");
    setTags((member?.tags ?? []).join(", "));
    setMemo(member?.memo ?? "");
  }, [open, member]);

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) {
      toast.error("이름을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const tagArr = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20);
      if (isDemoStore(storeCode)) {
        const now = new Date().toISOString();
        const m: CrmMember = {
          id: member?.id ?? `demo-mem-${Date.now()}`,
          storeCode: storeCode ?? DEMO_STORE_CODE,
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          kakaoUserKey: kakaoUserKey.trim() || null,
          role,
          status,
          memo: memo.trim() || null,
          tags: tagArr,
          lastContactAt: member?.lastContactAt ?? null,
          createdAt: member?.createdAt ?? now,
          updatedAt: now,
        };
        onSaved(m);
        toast.success(member ? "회원 정보가 수정되었습니다. (데모)" : "회원이 등록되었습니다. (데모)");
        onOpenChange(false);
        return;
      }
      let res;
      if (member) {
        res = await updateFn({
          data: { id: member.id, name, email, phone, kakaoUserKey, role, status, memo, tags: tagArr },
        });
      } else {
        res = await createFn({
          data: { storeCode, name, email, phone, kakaoUserKey, role, status, memo, tags: tagArr },
        });
      }
      onSaved(res.member);
      toast.success(member ? "회원 정보가 수정되었습니다." : "회원이 등록되었습니다.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => onOpenChange(false)}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h3 className="font-display font-bold text-base">{member ? "회원 수정" : "회원 등록"}</h3>
          <button onClick={() => onOpenChange(false)} className="size-8 grid place-items-center rounded-lg hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="이름 *">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="홍길동" />
          </Field>
          <Field label="이메일">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="user@example.com" />
          </Field>
          <Field label="전화번호">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="010-0000-0000" />
          </Field>
          <Field label="카카오 사용자 키" hint="카카오 상담과 연동할 user key (선택)">
            <input value={kakaoUserKey} onChange={(e) => setKakaoUserKey(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="권한/등급">
              <select value={role} onChange={(e) => setRole(e.target.value as MemberRoleType)} className={inputCls}>
                {MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="상태">
              <select value={status} onChange={(e) => setStatus(e.target.value as MemberStatusType)} className={inputCls}>
                {MEMBER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="태그" hint="쉼표로 구분 (예: 단골, 강남점)">
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} placeholder="단골, 신규" />
          </Field>
          <Field label="메모">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className={`${inputCls} h-auto py-2 resize-none`}
              placeholder="상담 특이사항 등"
            />
          </Field>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button onClick={() => onOpenChange(false)} className="h-10 px-4 rounded-xl border border-border text-sm">
            취소
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
