// filepath: src/components/MembersPanel.tsx
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { assignMemberRoleFn, listMembersFn, type MemberRow } from "@/lib/profiles.functions";
import { Loader2, RefreshCw, Users, Shield } from "lucide-react";

type Props = {
  storeCode?: string;
  isAdmin?: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "매장주",
  staff: "직원",
  admin: "관리자",
};

export function MembersPanel({ storeCode, isAdmin }: Props) {
  const listMembers = useServerFn(listMembersFn);
  const assignRole = useServerFn(assignMemberRoleFn);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMembers({ data: { storeCode } });
      setMembers(res.members);
    } finally {
      setLoading(false);
    }
  }, [listMembers, storeCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRoleChange = async (userId: string, role: "owner" | "staff" | "admin") => {
    try {
      await assignRole({ data: { userId, role } });
      toast.success("역할이 변경되었습니다.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "역할 변경 실패");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-secondary/50 overflow-y-auto">
      <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Users className="size-5 text-primary" /> 회원 관리
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            매장 코드 기준 워크스페이스 멤버 {members.length}명
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline mr-2" />
            멤버 로딩 중…
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            등록된 멤버가 없습니다.
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border overflow-hidden max-w-4xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">이름</th>
                  <th className="px-4 py-3 font-semibold">이메일</th>
                  <th className="px-4 py-3 font-semibold">역할</th>
                  <th className="px-4 py-3 font-semibold">가입일</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {m.displayName ?? m.businessName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <select
                          value={m.roles[0] ?? "owner"}
                          onChange={(e) =>
                            void handleRoleChange(m.id, e.target.value as "owner" | "staff" | "admin")
                          }
                          className="h-8 px-2 rounded-lg bg-secondary border border-border text-xs"
                        >
                          <option value="owner">매장주</option>
                          <option value="staff">직원</option>
                          <option value="admin">관리자</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold">
                          <Shield className="size-3" />
                          {ROLE_LABEL[m.roles[0] ?? "owner"] ?? m.roles[0]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
