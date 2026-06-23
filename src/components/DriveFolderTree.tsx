// filepath: src/components/DriveFolderTree.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDriveAssets } from "@/lib/drive.functions";
import { ChevronRight, Folder, FolderOpen, Loader2, HardDrive } from "lucide-react";

const FOLDER_MIME = "application/vnd.google-apps.folder";

export type Crumb = { id: string; name: string };

type Props = {
  rootId: string;
  selectedId: string | null;
  /** 현재 경로(브레드크럼)와 동기화하기 위해 변경 신호 */
  refreshKey?: number;
  onNavigate: (path: Crumb[]) => void;
};

export function DriveFolderTree({ rootId, selectedId, refreshKey, onNavigate }: Props) {
  return (
    <div className="text-sm">
      <TreeNode
        folder={{ id: rootId, name: "소재함 (루트)" }}
        nodePath={[{ id: rootId, name: "소재함 (루트)" }]}
        depth={0}
        selectedId={selectedId}
        refreshKey={refreshKey}
        onNavigate={onNavigate}
        isRoot
      />
    </div>
  );
}

function TreeNode({
  folder,
  nodePath,
  depth,
  selectedId,
  refreshKey,
  onNavigate,
  isRoot,
}: {
  folder: Crumb;
  nodePath: Crumb[];
  depth: number;
  selectedId: string | null;
  refreshKey?: number;
  onNavigate: (path: Crumb[]) => void;
  isRoot?: boolean;
}) {
  const [expanded, setExpanded] = useState<boolean>(Boolean(isRoot));
  const list = useServerFn(listDriveAssets);

  const childrenQuery = useQuery({
    queryKey: ["drive-folders", folder.id, refreshKey],
    queryFn: () => list({ data: { folderId: folder.id } }),
    enabled: expanded,
  });

  const subFolders = (childrenQuery.data?.files ?? []).filter((f) => f.mimeType === FOLDER_MIME);
  const selected = selectedId === folder.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-lg pr-2 py-1 cursor-pointer hover:bg-secondary/70 ${
          selected ? "bg-secondary font-semibold" : ""
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={() => onNavigate(nodePath)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="size-4 grid place-items-center shrink-0 text-muted-foreground"
        >
          <ChevronRight className={`size-3.5 transition ${expanded ? "rotate-90" : ""}`} />
        </button>
        {isRoot ? (
          <HardDrive className="size-4 shrink-0 text-primary" />
        ) : selected ? (
          <FolderOpen className="size-4 shrink-0 text-primary" />
        ) : (
          <Folder className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{folder.name}</span>
      </div>

      {expanded && (
        <div>
          {childrenQuery.isLoading ? (
            <div
              className="flex items-center gap-1 py-1 text-xs text-muted-foreground"
              style={{ paddingLeft: `${depth * 14 + 26}px` }}
            >
              <Loader2 className="size-3 animate-spin" /> 불러오는 중…
            </div>
          ) : subFolders.length === 0 ? (
            <div
              className="py-1 text-[11px] text-muted-foreground/70"
              style={{ paddingLeft: `${depth * 14 + 26}px` }}
            >
              하위 폴더 없음
            </div>
          ) : (
            subFolders.map((sf) => (
              <TreeNode
                key={sf.id}
                folder={{ id: sf.id, name: sf.name }}
                nodePath={[...nodePath, { id: sf.id, name: sf.name }]}
                depth={depth + 1}
                selectedId={selectedId}
                refreshKey={refreshKey}
                onNavigate={onNavigate}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
