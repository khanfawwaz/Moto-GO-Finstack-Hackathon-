import { useRef, useState, type DragEvent } from "react";
import { Camera, CheckCircle2, FileUp, RefreshCcw, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import type { Doc } from "@/api/types";
import { bytes } from "@/lib/format";
import { isBusy, KIND_LABEL, KIND_MIMES, runUpload, useUploads, validateFile } from "@/lib/upload";
import { cx } from "./ui";

interface Props {
  id: string; kind: string; label?: string; applicationId?: string; requirementId?: string; vehicleId?: string;
  value?: string; onChange?: (docId: string | undefined, doc?: Doc) => void; onResult?: (doc: Doc) => void;
  capture?: "user" | "environment"; compact?: boolean; error?: string; hint?: string;
}

/** Drag-and-drop on desktop, camera/file picker on mobile. Shows processing -> verified / needs attention / rejected. */
export function UploadField({ id, kind, label, applicationId, requirementId, vehicleId, value, onChange, onResult, capture, compact, error, hint }: Props) {
  const key = `${id}:${requirementId ?? ""}`;
  const item = useUploads((s) => s.items[key]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const mimes = KIND_MIMES[kind] ?? [];

  const start = async (file?: File) => {
    if (!file) return;
    const err = validateFile(file, mimes);
    setLocalErr(err);
    if (err) return;
    onChange?.(undefined);
    const doc = await runUpload({ key, file, kind, applicationId, requirementId, vehicleId });
    if (doc) { onChange?.(doc.id, doc); onResult?.(doc); }
  };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); void start(e.dataTransfer.files?.[0]); };

  const phase = item?.phase;
  const done = phase === "verified" || phase === "needs_attention";
  const bad = phase === "rejected" || phase === "error";
  const tone = phase === "verified" ? "border-go bg-go-light/40" : phase === "needs_attention" ? "border-sun bg-sun-light/50"
    : bad || error || localErr ? "border-coral bg-coral-light/30" : over ? "border-go bg-go-light/30" : "border-ink/20 bg-white";

  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
        className={cx("rounded-3xl border-2 border-dashed transition", tone, compact ? "p-3" : "p-4")}>
        <input ref={inputRef} id={id} type="file" className="sr-only" accept={mimes.join(",")} capture={capture}
          onChange={(e) => { void start(e.target.files?.[0]); e.target.value = ""; }} aria-describedby={`${id}-status`} />
        {!item ? (
          <div className="flex flex-wrap items-center gap-3">
            <FileUp className="h-6 w-6 text-ink-mute" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">{value ? "A file is attached. Replace it?" : `Drop your ${KIND_LABEL[kind]?.toLowerCase() ?? "file"} here`}</p>
              <p className="text-xs font-semibold text-ink-mute">{hint ?? `${mimes.map((m) => m.split("/")[1].toUpperCase()).join(", ")} · up to 10 MB`}</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => inputRef.current?.click()}>
              {capture ? <Camera className="h-4 w-4" aria-hidden /> : null}{capture ? "Take photo" : "Choose file"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3" id={`${id}-status`} role="status" aria-live="polite">
            {isBusy(item) ? <Loader2 className="h-6 w-6 animate-spin text-sky-dark" aria-hidden />
              : phase === "verified" ? <CheckCircle2 className="h-6 w-6 text-go-dark" aria-hidden />
              : phase === "needs_attention" ? <AlertTriangle className="h-6 w-6 text-sun-dark" aria-hidden />
              : <XCircle className="h-6 w-6 text-coral-dark" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{item.name}</p>
              <p className="text-xs font-bold text-ink-soft">
                {phase === "hashing" && "Preparing…"}
                {phase === "uploading" && `Uploading ${Math.round(item.progress * 100)}%`}
                {phase === "processing" && "Checking your document. This takes a few seconds."}
                {phase === "verified" && "Verified. No further action needed."}
                {phase === "needs_attention" && (item.reason ?? "Needs attention")}
                {bad && (item.reason ?? "We couldn't use this file.")}
              </p>
              {phase === "uploading" && (
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink/10"><div className="h-full bg-sky transition-all" style={{ width: `${item.progress * 100}%` }} /></div>
              )}
            </div>
            {!isBusy(item) && (
              <button type="button" className="btn-ghost" onClick={() => (phase === "error" && item.retry ? item.retry() : inputRef.current?.click())}>
                <RefreshCcw className="h-4 w-4" aria-hidden />{done ? "Replace" : "Try again"}
              </button>
            )}
          </div>
        )}
      </div>
      {(error || localErr) && <p className="err" role="alert">{localErr ?? error}</p>}
    </div>
  );
}

export { bytes };
