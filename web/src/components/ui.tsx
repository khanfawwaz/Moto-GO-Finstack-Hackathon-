import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, CarFront, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { ApiError } from "@/api/client";
import { useMeta } from "@/api/hooks";
import { SEGMENT_COLOR } from "@/lib/format";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-10 text-ink-soft">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> <span className="font-bold">{label}…</span>
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
  return (
    <div role="alert" className="card flex items-start gap-3 border-coral/40 bg-coral-light/40">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-coral-dark" aria-hidden />
      <div className="flex-1">
        <p className="font-extrabold text-coral-dark">{msg}</p>
        {retry && <button className="btn-ghost mt-3" onClick={retry}>Try again</button>}
      </div>
    </div>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  const { data } = useMeta();
  if (!data?.demo) return null;
  return (
    <span title="Every outside service in this journey is simulated. No real identity data or credit enquiries."
      className={cx("chip border-2 border-sun-dark/30 bg-sun-light text-sun-dark", className)}>
      <span aria-hidden>●</span> Demo
    </span>
  );
}

export function Callout({ tone = "info", children, title }: { tone?: "info" | "warn" | "ok"; title?: string; children: ReactNode }) {
  const t = { info: ["bg-sky-light/70 border-sky/40", Info, "text-sky-dark"], warn: ["bg-sun-light/70 border-sun/60", AlertTriangle, "text-sun-dark"],
    ok: ["bg-go-light/60 border-go/40", CheckCircle2, "text-go-dark"] }[tone] as [string, typeof Info, string];
  const Icon = t[1];
  return (
    <div className={cx("flex gap-3 rounded-2xl border-2 p-4 text-sm font-semibold", t[0])}>
      <Icon className={cx("mt-0.5 h-5 w-5 shrink-0", t[2])} aria-hidden />
      <div>{title && <p className="mb-0.5 font-extrabold">{title}</p>}{children}</div>
    </div>
  );
}

export function PageHeader({ title, sub, action, back }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {back}
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl font-semibold text-ink-soft">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed py-10 text-center">
      <CarFront className="h-14 w-14 text-go" aria-hidden />
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-md font-semibold text-ink-soft">{body}</p>
      <div className="mt-1 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
}

export function SegmentDot({ segment }: { segment: string }) {
  return <span className="inline-block h-3 w-3 rounded-full border-2 border-ink" style={{ background: SEGMENT_COLOR[segment] }} aria-hidden />;
}

export function ProgressBar({ value, max, label, tone = "go" }: { value: number; max: number; label: string; tone?: "go" | "sun" }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className="h-3.5 w-full overflow-hidden rounded-full border-2 border-ink/20 bg-white">
      <div className={cx("h-full rounded-full transition-all", tone === "go" ? "bg-go" : "bg-sun")} style={{ width: `${pct}%` }} />
    </div>
  );
}

const TONES: Record<string, string> = {
  verified: "bg-go-light text-go-dark", needs_attention: "bg-sun-light text-sun-dark", rejected: "bg-coral-light text-coral-dark",
  processing: "bg-sky-light text-sky-dark", uploading: "bg-sky-light text-sky-dark", open: "bg-sun-light text-sun-dark", resolved: "bg-go-light text-go-dark",
};
const LABELS: Record<string, string> = { verified: "Verified", needs_attention: "Needs attention", rejected: "Rejected", processing: "Checking…", uploading: "Uploading…", open: "Needed", resolved: "Done" };
export function StatusChip({ status }: { status: string }) {
  return <span className={cx("chip", TONES[status] ?? "bg-ink/10 text-ink-soft")}>{LABELS[status] ?? status}</span>;
}

// ---------- toasts ----------
const ToastCtx = createContext<(msg: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: string }[]>([]);
  const n = useRef(0);
  const push = useCallback((msg: string, tone: "ok" | "err" = "ok") => {
    const id = ++n.current;
    setItems((s) => [...s, { id, msg, tone }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto max-w-md animate-pop rounded-2xl border-2 px-4 py-3 text-sm font-extrabold shadow-pop",
            t.tone === "ok" ? "border-go bg-white text-go-dark" : "border-coral bg-white text-coral-dark")}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Sheet({ open, onOpenChange, title, children, description }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-4xl border-2 border-ink/10 bg-white p-6 shadow-pop md:inset-auto md:left-1/2 md:top-1/2 md:w-[min(560px,92vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-4xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-xl font-extrabold">{title}</Dialog.Title>
              <Dialog.Description className={description ? "mt-1 text-sm font-semibold text-ink-soft" : "sr-only"}>{description ?? title}</Dialog.Description>
            </div>
            <Dialog.Close className="btn-quiet !min-h-[44px] !min-w-[44px] !p-2" aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className="text-xl font-extrabold">{value}</p>
      {sub && <p className="text-xs font-semibold text-ink-mute">{sub}</p>}
    </div>
  );
}
