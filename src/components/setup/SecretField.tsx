// filepath: src/components/setup/SecretField.tsx
import { ExternalLink, HelpCircle } from "lucide-react";

type Props = {
  label: string;
  hint?: string;
  helpUrl?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password" | "url";
  masked?: string | null;
  mono?: boolean;
};

export function SecretField({
  label,
  hint,
  helpUrl,
  value,
  onChange,
  placeholder,
  type = "text",
  masked,
  mono,
}: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-foreground">{label}</label>
        {helpUrl && (
          <a
            href={helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary inline-flex items-center gap-0.5 hover:underline"
          >
            발급 방법 <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {hint && (
        <p className="text-[11px] text-muted-foreground flex items-start gap-1">
          <HelpCircle className="size-3 shrink-0 mt-0.5" />
          {hint}
        </p>
      )}
      {masked && !value && (
        <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">저장됨 {masked}</p>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? (masked ? "변경 시에만 입력" : "")}
        className={`w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          mono ? "font-mono text-xs" : ""
        }`}
      />
    </div>
  );
}
