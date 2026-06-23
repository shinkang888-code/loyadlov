// filepath: src/components/AssetsPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listDriveAssets,
  uploadDriveAsset,
  deleteDriveAsset,
  createDriveFolderFn,
  renameDriveAsset,
} from "@/lib/drive.functions";
import { DriveFolderTree, type Crumb } from "@/components/DriveFolderTree";
import {
  FolderOpen,
  Upload,
  Trash2,
  ExternalLink,
  FileImage,
  Loader2,
  Folder,
  FolderPlus,
  ChevronRight,
  RefreshCw,
  LayoutGrid,
  List,
  Pencil,
  Home,
  HardDrive,
  FileText,
  FileVideo,
  File as FileIcon,
} from "lucide-react";

const FOLDER_MIME = "application/vnd.google-apps.folder";

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

function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType === FOLDER_MIME) return <Folder className={className} />;
  if (mimeType.startsWith("image/")) return <FileImage className={className} />;
  if (mimeType.startsWith("video/")) return <FileVideo className={className} />;
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.startsWith("text/"))
    return <FileText className={className} />;
  return <FileIcon className={className} />;
}

export function AssetsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listDriveAssets);
  const upload = useServerFn(uploadDriveAsset);
  const remove = useServerFn(deleteDriveAsset);
  const createFolder = useServerFn(createDriveFolderFn);
  const rename = useServerFn(renameDriveAsset);

  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<Crumb[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dragOver, setDragOver] = useState(false);
  const [treeRefresh, setTreeRefresh] = useState(0);

  // 루트 폴더 ID 확보 (한 번)
  const rootQuery = useQuery({
    queryKey: ["drive-root"],
    queryFn: () => list({ data: {} }),
  });
  const rootId = rootQuery.data?.rootFolderId ?? null;

  useEffect(() => {
    if (rootId && path.length === 0) {
      setPath([{ id: rootId, name: "소재함 (루트)" }]);
    }
  }, [rootId, path.length]);

  const current = path[path.length - 1] ?? null;
  const currentId = current?.id ?? null;

  const filesQuery = useQuery({
    queryKey: ["drive", currentId],
    queryFn: () => list({ data: { folderId: currentId ?? undefined } }),
    enabled: Boolean(currentId),
  });

  const all = filesQuery.data?.files ?? [];
  const folders = useMemo(() => all.filter((f) => f.mimeType === FOLDER_MIME), [all]);
  const docs = useMemo(() => all.filter((f) => f.mimeType !== FOLDER_MIME), [all]);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["drive", currentId] });
    setTreeRefresh((n) => n + 1);
  }, [qc, currentId]);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return upload({
        data: {
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          base64,
          folderId: currentId ?? undefined,
        },
      });
    },
    onSuccess: invalidate,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "업로드 실패"),
  });

  const deleteMut = useMutation({
    mutationFn: (fileId: string) => remove({ data: { fileId } }),
    onSuccess: invalidate,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "삭제 실패"),
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

  const handleNewFolder = async () => {
    const name = prompt("새 폴더 이름");
    if (!name?.trim()) return;
    try {
      await createFolder({ data: { name: name.trim(), parentId: currentId ?? undefined } });
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "폴더 생성 실패");
    }
  };

  const handleRename = async (fileId: string, currentName: string) => {
    const name = prompt("새 이름", currentName);
    if (!name?.trim() || name === currentName) return;
    try {
      await rename({ data: { fileId, name: name.trim() } });
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "이름 변경 실패");
    }
  };

  const openFolder = (f: Crumb) => setPath((p) => [...p, { id: f.id, name: f.name }]);
  const goToCrumb = (i: number) => setPath((p) => p.slice(0, i + 1));

  const loading = rootQuery.isLoading || (filesQuery.isLoading && Boolean(currentId));
  const driveError = rootQuery.isError ? (rootQuery.error as Error) : null;

  return (
    <div className="flex-1 flex min-w-0 bg-secondary/30">
      {/* 좌측 네비게이터 (폴더 트리) */}
      <aside className="w-[260px] shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <HardDrive className="size-4 text-primary" />
          <span className="font-display font-bold text-sm">탐색기</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {rootId ? (
            <DriveFolderTree
              rootId={rootId}
              selectedId={currentId}
              refreshKey={treeRefresh}
              onNavigate={setPath}
            />
          ) : (
            <div className="p-4 text-xs text-muted-foreground">
              {driveError ? "Drive 연결 필요" : "로딩 중…"}
            </div>
          )}
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 + 브레드크럼 + 액션 */}
        <div className="px-5 py-3 border-b border-border bg-card">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <FolderOpen className="size-3" /> Google Drive · 소재함
              </div>
              <nav className="flex items-center gap-0.5 mt-1 text-sm font-medium overflow-x-auto">
                {path.length === 0 ? (
                  <span className="text-muted-foreground">로딩 중…</span>
                ) : (
                  path.map((c, i) => (
                    <span key={c.id} className="flex items-center shrink-0">
                      {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground mx-0.5" />}
                      <button
                        onClick={() => goToCrumb(i)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-secondary ${
                          i === path.length - 1 ? "text-foreground font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        {i === 0 && <Home className="size-3.5" />}
                        {c.name}
                      </button>
                    </span>
                  ))
                )}
              </nav>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`size-8 grid place-items-center ${viewMode === "grid" ? "bg-secondary" : ""}`}
                  title="그리드"
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`size-8 grid place-items-center ${viewMode === "list" ? "bg-secondary" : ""}`}
                  title="목록"
                >
                  <List className="size-4" />
                </button>
              </div>
              <button
                onClick={() => void handleNewFolder()}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary"
              >
                <FolderPlus className="size-3.5" /> 새 폴더
              </button>
              <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploadMut.isPending || !currentId}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {uploadMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                업로드
              </button>
              <button
                onClick={invalidate}
                className="size-8 grid place-items-center rounded-lg border border-border hover:bg-secondary"
                title="새로고침"
              >
                <RefreshCw className={`size-4 ${filesQuery.isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs underline">
              닫기
            </button>
          </div>
        )}

        {/* 파일/폴더 영역 (드롭존) */}
        <div
          className={`flex-1 overflow-y-auto p-5 ${dragOver ? "bg-primary/5 ring-2 ring-primary/30 ring-inset" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void onPick(e.dataTransfer.files);
          }}
        >
          {driveError ? (
            <div className="p-6 rounded-2xl bg-card border border-destructive/30 text-sm max-w-xl">
              <div className="font-semibold text-destructive mb-1">Google Drive 연결 오류</div>
              <div className="text-muted-foreground">{driveError.message}</div>
              <div className="mt-3 text-xs text-muted-foreground">
                팁: 설정에서 서비스 계정/루트 폴더 ID를 입력하고, Drive 폴더를 서비스 계정 이메일에 “편집자”로 공유하세요.
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" /> 불러오는 중…
            </div>
          ) : folders.length === 0 && docs.length === 0 ? (
            <div className="p-10 rounded-2xl bg-card border border-border text-center max-w-xl mx-auto">
              <FileImage className="size-8 mx-auto text-muted-foreground/60" />
              <div className="mt-3 font-semibold">이 폴더는 비어 있습니다</div>
              <div className="text-sm text-muted-foreground mt-1">
                파일을 드래그해서 올리거나 “업로드 / 새 폴더”를 사용하세요.
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="space-y-5">
              {folders.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground mb-2">폴더</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {folders.map((f) => (
                      <div
                        key={f.id}
                        onDoubleClick={() => openFolder({ id: f.id, name: f.name })}
                        className="group rounded-xl bg-card border border-border p-3 flex items-center gap-2 hover:shadow-soft hover:border-primary/40 transition cursor-pointer"
                        onClick={() => openFolder({ id: f.id, name: f.name })}
                      >
                        <Folder className="size-7 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate flex-1" title={f.name}>
                          {f.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRename(f.id, f.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 size-7 grid place-items-center rounded-lg hover:bg-secondary text-muted-foreground"
                          title="이름 변경"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`폴더 '${f.name}' 삭제할까요? (안의 파일도 삭제됨)`))
                              deleteMut.mutate(f.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 size-7 grid place-items-center rounded-lg hover:bg-destructive/10 text-destructive"
                          title="삭제"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {docs.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground mb-2">파일</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {docs.map((f) => (
                      <div
                        key={f.id}
                        className="group rounded-xl bg-card border border-border overflow-hidden shadow-soft hover:shadow-navy transition"
                      >
                        <div className="aspect-square bg-secondary/60 flex items-center justify-center overflow-hidden">
                          {f.thumbnailLink ? (
                            <img
                              src={f.thumbnailLink}
                              alt={f.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <FileTypeIcon mimeType={f.mimeType} className="size-10 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="p-2.5">
                          <div className="text-xs font-semibold truncate" title={f.name}>
                            {f.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-between">
                            <span>{formatSize(f.size)}</span>
                            <span>{f.modifiedTime?.slice(0, 10)}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-2">
                            {f.webViewLink && (
                              <a
                                href={f.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-1 h-7 rounded-lg bg-secondary text-[11px] hover:bg-secondary/70 transition"
                              >
                                <ExternalLink className="size-3" /> 열기
                              </a>
                            )}
                            <button
                              onClick={() => void handleRename(f.id, f.name)}
                              className="size-7 grid place-items-center rounded-lg bg-secondary hover:bg-secondary/70"
                              title="이름 변경"
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`${f.name} 삭제할까요?`)) deleteMut.mutate(f.id);
                              }}
                              disabled={deleteMut.isPending}
                              className="size-7 grid place-items-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
                              title="삭제"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 목록 보기 */
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">이름</th>
                    <th className="px-4 py-2.5 font-semibold w-24">크기</th>
                    <th className="px-4 py-2.5 font-semibold w-28">수정일</th>
                    <th className="px-4 py-2.5 font-semibold w-28 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {[...folders, ...docs].map((f) => {
                    const isFolder = f.mimeType === FOLDER_MIME;
                    return (
                      <tr key={f.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => isFolder && openFolder({ id: f.id, name: f.name })}
                            className={`inline-flex items-center gap-2 ${isFolder ? "font-medium" : ""}`}
                          >
                            <FileTypeIcon
                              mimeType={f.mimeType}
                              className={`size-4 ${isFolder ? "text-primary" : "text-muted-foreground"}`}
                            />
                            <span className="truncate">{f.name}</span>
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {isFolder ? "—" : formatSize(f.size)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {f.modifiedTime?.slice(0, 10)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {f.webViewLink && (
                              <a
                                href={f.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="size-7 grid place-items-center rounded-lg bg-secondary hover:bg-secondary/70"
                                title="열기"
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => void handleRename(f.id, f.name)}
                              className="size-7 grid place-items-center rounded-lg bg-secondary hover:bg-secondary/70"
                              title="이름 변경"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`${f.name} 삭제할까요?`)) deleteMut.mutate(f.id);
                              }}
                              className="size-7 grid place-items-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                              title="삭제"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
