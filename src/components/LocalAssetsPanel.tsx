// filepath: src/components/LocalAssetsPanel.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteLocalAssetFn,
  getLocalAssetsConfigFn,
  getLocalAssetPreviewFn,
  getLocalAssetsStatusFn,
  listLocalAssetsFn,
  mkdirLocalAssetFn,
  setLocalAssetsRootFn,
  uploadLocalAssetFn,
} from "@/lib/localAssets.functions";
import {
  FolderOpen,
  Upload,
  Trash2,
  Loader2,
  HardDrive,
  Save,
  FolderPlus,
  ChevronRight,
  Home,
  FileImage,
  Folder,
} from "lucide-react";
import { toast } from "sonner";

type Props = {
  storeCode?: string;
};

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

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function LocalThumb({
  storeCode,
  relativePath,
  mimeType,
}: {
  storeCode?: string;
  relativePath: string;
  mimeType: string | null;
}) {
  const preview = useServerFn(getLocalAssetPreviewFn);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!mimeType?.startsWith("image/")) return;
    void preview({ data: { storeCode, relativePath } })
      .then((r) => setSrc(r.dataUrl))
      .catch(() => setSrc(null));
  }, [preview, storeCode, relativePath, mimeType]);

  if (src) {
    return <img src={src} alt="" className="w-full h-full object-cover" />;
  }
  return mimeType?.startsWith("image/") ? (
    <Loader2 className="size-6 animate-spin text-muted-foreground" />
  ) : (
    <FileImage className="size-10 text-muted-foreground/50" />
  );
}

export function LocalAssetsPanel({ storeCode }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [relativeDir, setRelativeDir] = useState("");
  const [rootInput, setRootInput] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [error, setError] = useState<string | null>(null);

  const statusFn = useServerFn(getLocalAssetsStatusFn);
  const configFn = useServerFn(getLocalAssetsConfigFn);
  const listFn = useServerFn(listLocalAssetsFn);
  const uploadFn = useServerFn(uploadLocalAssetFn);
  const deleteFn = useServerFn(deleteLocalAssetFn);
  const mkdirFn = useServerFn(mkdirLocalAssetFn);
  const saveRootFn = useServerFn(setLocalAssetsRootFn);

  const status = useQuery({
    queryKey: ["local-assets-status", storeCode],
    queryFn: () => statusFn({ data: { storeCode } }),
  });

  const config = useQuery({
    queryKey: ["local-assets-config", storeCode],
    queryFn: () => configFn({ data: { storeCode } }),
    enabled: status.data?.enabled === true,
  });

  useEffect(() => {
    if (config.data) {
      setRootInput(config.data.storeRoot || config.data.defaultRoot || "");
    }
  }, [config.data]);

  const list = useQuery({
    queryKey: ["local-assets", storeCode, relativeDir],
    queryFn: () => listFn({ data: { storeCode, relativeDir } }),
    enabled: status.data?.enabled === true && status.data?.configured === true,
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return uploadFn({
        data: { storeCode, relativeDir, name: file.name, base64 },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["local-assets", storeCode] });
      toast.success("업로드 완료");
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (relativePath: string) => deleteFn({ data: { storeCode, relativePath } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["local-assets", storeCode] });
      toast.success("삭제 완료");
    },
    onError: (e: Error) => setError(e.message),
  });

  const mkdirMut = useMutation({
    mutationFn: (folderName: string) =>
      mkdirFn({ data: { storeCode, relativeDir, folderName } }),
    onSuccess: () => {
      setNewFolder("");
      void qc.invalidateQueries({ queryKey: ["local-assets", storeCode] });
      toast.success("폴더 생성됨");
    },
    onError: (e: Error) => setError(e.message),
  });

  const saveRootMut = useMutation({
    mutationFn: () => saveRootFn({ data: { storeCode, rootPath: rootInput, scope: "store" } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["local-assets-status", storeCode] });
      void qc.invalidateQueries({ queryKey: ["local-assets-config", storeCode] });
      void qc.invalidateQueries({ queryKey: ["local-assets", storeCode] });
      toast.success("로컬 폴더 경로가 저장되었습니다.");
    },
    onError: (e: Error) => setError(e.message),
  });

  const onPick = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setError(null);
      for (const f of Array.from(files)) {
        if (f.size > 50 * 1024 * 1024) {
          setError(`${f.name}: 50MB 초과`);
          continue;
        }
        await uploadMut.mutateAsync(f);
      }
      if (inputRef.current) inputRef.current.value = "";
    },
    [uploadMut]
  );

  const crumbs = relativeDir ? relativeDir.split("/").filter(Boolean) : [];

  if (status.isLoading) {
    return (
      <div className="flex-1 grid place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2 inline" /> 확인 중…
      </div>
    );
  }

  if (!status.data?.enabled) {
    return (
      <div className="flex-1 p-8 max-w-lg mx-auto text-center text-sm text-muted-foreground">
        <HardDrive className="size-10 mx-auto mb-3 opacity-50" />
        <p>로컬 폴더 소재함은 개발 서버(NODE_ENV=development)에서만 사용할 수 있습니다.</p>
        <p className="mt-2 text-xs">C: 클론에서 <code className="bg-secondary px-1 rounded">npm run dev</code>로 실행하세요.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-secondary/30">
      <div className="max-w-6xl mx-auto space-y-5">
        <header>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <HardDrive className="size-3.5" /> 로컬 폴더 (C: 개발)
          </div>
          <h1 className="font-display text-2xl font-bold mt-1">로컬 소재함</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Windows 폴더 경로를 지정하면 PC에 직접 업로드·관리합니다. (프로덕션 비활성)
          </p>
        </header>

        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="size-4 text-primary" /> 폴더 경로 설정
          </div>
          <input
            value={rootInput}
            onChange={(e) => setRootInput(e.target.value)}
            disabled={!config.data?.canEdit}
            placeholder="C:\Users\user\dev\loyadbeta\local-assets"
            className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>현재: {status.data?.rootPath ?? "미설정"}</span>
            {config.data?.allowedPrefixes && (
              <span>· 허용 접두사: {config.data.allowedPrefixes.join(", ")}</span>
            )}
          </div>
          {config.data?.canEdit && (
            <button
              type="button"
              onClick={() => void saveRootMut.mutate()}
              disabled={saveRootMut.isPending || !rootInput.trim()}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-primary-foreground text-xs font-semibold disabled:opacity-60"
            >
              {saveRootMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              경로 저장
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {error}
          </div>
        )}

        {!status.data?.configured ? (
          <div className="p-8 rounded-2xl bg-card border border-dashed border-border text-center text-sm text-muted-foreground">
            위에서 C: 드라이브 폴더 경로를 저장한 뒤 파일을 업로드하세요.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <nav className="flex items-center gap-1 text-xs flex-wrap">
                <button
                  type="button"
                  onClick={() => setRelativeDir("")}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary"
                >
                  <Home className="size-3" /> 루트
                </button>
                {crumbs.map((c, i) => {
                  const path = crumbs.slice(0, i + 1).join("/");
                  return (
                    <span key={path} className="flex items-center gap-1">
                      <ChevronRight className="size-3 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={() => setRelativeDir(path)}
                        className="px-2 py-1 rounded-lg hover:bg-secondary"
                      >
                        {c}
                      </button>
                    </span>
                  );
                })}
              </nav>
              <div className="flex items-center gap-2">
                <input
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  placeholder="새 폴더명"
                  className="h-9 px-3 rounded-lg bg-card border border-border text-xs w-36"
                />
                <button
                  type="button"
                  onClick={() => newFolder.trim() && mkdirMut.mutate(newFolder.trim())}
                  disabled={mkdirMut.isPending}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-border text-xs hover:bg-secondary"
                >
                  <FolderPlus className="size-3.5" /> 폴더
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void onPick(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploadMut.isPending}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-brand text-primary-foreground text-xs font-semibold"
                >
                  {uploadMut.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  업로드
                </button>
              </div>
            </div>

            {list.isLoading ? (
              <div className="py-16 text-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin inline mr-2" /> 불러오는 중…
              </div>
            ) : list.isError ? (
              <div className="p-4 rounded-xl bg-destructive/10 text-sm text-destructive">
                {(list.error as Error).message}
              </div>
            ) : (list.data?.items.length ?? 0) === 0 ? (
              <div className="p-10 rounded-2xl bg-card border text-center text-sm text-muted-foreground">
                이 폴더가 비어 있습니다. 파일을 업로드하세요.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {list.data?.items.map((item) => (
                  <div
                    key={item.relativePath}
                    className="group rounded-2xl bg-card border border-border overflow-hidden shadow-soft"
                  >
                    <button
                      type="button"
                      className="w-full aspect-square bg-secondary/60 flex items-center justify-center overflow-hidden"
                      onClick={() => {
                        if (item.isDirectory) setRelativeDir(item.relativePath);
                      }}
                    >
                      {item.isDirectory ? (
                        <Folder className="size-12 text-primary/70" />
                      ) : (
                        <LocalThumb
                          storeCode={storeCode}
                          relativePath={item.relativePath}
                          mimeType={item.mimeType}
                        />
                      )}
                    </button>
                    <div className="p-3">
                      <div className="text-sm font-semibold truncate" title={item.name}>
                        {item.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex justify-between">
                        <span>{item.isDirectory ? "폴더" : formatSize(item.size)}</span>
                        <span>{item.modifiedAt.slice(0, 10)}</span>
                      </div>
                      {!item.isDirectory && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`${item.name} 삭제할까요?`)) deleteMut.mutate(item.relativePath);
                          }}
                          className="mt-2 h-8 w-full rounded-lg bg-destructive/10 text-destructive text-xs hover:bg-destructive/20"
                        >
                          <Trash2 className="size-3.5 inline mr-1" /> 삭제
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
