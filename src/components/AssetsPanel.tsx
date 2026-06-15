import { useCallback, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDriveAssets, uploadDriveAsset, deleteDriveAsset } from "@/lib/drive.functions";
import { FolderOpen, Upload, Trash2, ExternalLink, FileImage, Loader2 } from "lucide-react";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function formatSize(bytes?: string) {
  if (!bytes) return "—";
  const n = Number(bytes);
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AssetsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listDriveAssets);
  const upload = useServerFn(uploadDriveAsset);
  const remove = useServerFn(deleteDriveAsset);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["drive-assets"],
    queryFn: () => list({ data: {} }),
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return upload({
        data: { name: file.name, mimeType: file.type || "application/octet-stream", base64 },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive-assets"] }),
    onError: (e: any) => setError(e?.message ?? "업로드 실패"),
  });

  const deleteMut = useMutation({
    mutationFn: (fileId: string) => remove({ data: { fileId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive-assets"] }),
    onError: (e: any) => setError(e?.message ?? "삭제 실패"),
  });

  const onPick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      for (const f of Array.from(files)) {
        if (f.size > 15 * 1024 * 1024) {
          setError(`${f.name}: 15MB 초과 파일은 업로드할 수 없습니다.`);
          continue;
        }
        await uploadMut.mutateAsync(f);
      }
      if (inputRef.current) inputRef.current.value = "";
    },
    [uploadMut],
  );

  const files = query.data?.files ?? [];

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <FolderOpen className="size-3.5" /> Google Drive
            </div>
            <h1 className="font-display text-2xl font-bold mt-1">소재함</h1>
            <p className="text-sm text-muted-foreground mt-1">
              매장 운영에 쓰일 사진·영상·문서를 한 곳에서 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploadMut.isPending}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand text-primary-foreground text-sm font-semibold shadow-navy hover:opacity-90 transition disabled:opacity-60"
            >
              {uploadMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              파일 업로드
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {error}
          </div>
        )}

        {query.isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" /> 불러오는 중…
          </div>
        ) : query.isError ? (
          <div className="p-6 rounded-2xl bg-card border border-destructive/30 text-sm">
            <div className="font-semibold text-destructive mb-1">Google Drive 연결 오류</div>
            <div className="text-muted-foreground">
              {(query.error as Error)?.message ??
                "서비스 계정 권한 또는 폴더 공유를 확인해주세요."}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              팁: Drive 폴더를 서비스 계정 이메일에 “편집자”로 공유했는지 확인하세요.
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="p-10 rounded-2xl bg-card border border-border text-center">
            <FileImage className="size-8 mx-auto text-muted-foreground/60" />
            <div className="mt-3 font-semibold">아직 업로드된 소재가 없습니다</div>
            <div className="text-sm text-muted-foreground mt-1">
              우측 상단 “파일 업로드”로 첫 소재를 올려보세요.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((f) => (
              <div
                key={f.id}
                className="group rounded-2xl bg-card border border-border overflow-hidden shadow-soft hover:shadow-navy transition"
              >
                <div className="aspect-square bg-secondary/60 flex items-center justify-center overflow-hidden">
                  {f.thumbnailLink ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.thumbnailLink}
                      alt={f.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <FileImage className="size-10 text-muted-foreground/50" />
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold truncate" title={f.name}>
                    {f.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-between">
                    <span>{formatSize(f.size)}</span>
                    <span>{f.modifiedTime?.slice(0, 10)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {f.webViewLink && (
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-lg bg-secondary text-xs hover:bg-secondary/70 transition"
                      >
                        <ExternalLink className="size-3" /> 열기
                      </a>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`${f.name} 삭제할까요?`)) deleteMut.mutate(f.id);
                      }}
                      disabled={deleteMut.isPending}
                      className="h-8 px-2 rounded-lg bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition"
                      aria-label="삭제"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
