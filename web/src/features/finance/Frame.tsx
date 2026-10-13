import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { api } from "@/api/client";
import { useInvalidate } from "@/api/hooks";
import type { Application } from "@/api/types";
import { Logo } from "@/components/AppShell";
import { cx, DemoBadge, Stat } from "@/components/ui";
import { inr } from "@/lib/format";

const STAGES = ["Details", "Identity", "Credit report", "Income", "Work", "Vehicle", "Offers", "Sign & funds"];
const STEP_STAGE: Record<string, number> = { intake: 0, identity: 0, kyc: 1, remediation: 1, bureau: 2, evidence: 3, work: 4, vehicle: 5, status: 6, offers: 6, kfs: 6, mandate: 7, esign: 7, disbursal: 7, handoff: 7 };

export const STATE_LABEL: Record<string, string> = {
  draft: "Started", consented: "Details shared", identity_pending: "Checking identity", evidence_pending: "Collecting evidence",
  underwriting: "Lender reviewing", more_info: "Lender needs more", offered: "Offers ready", accepted: "Offer accepted",
  mandate_pending: "Setting up repayments", signed: "Signed", disbursal_pending: "Paying the dealer", disbursed: "Paid to dealer",
  declined: "Not approved", cancelled: "Cancelled", expired: "Expired", error: "Needs support",
};

export function FinanceFrame({ app, stage, children, narrow }: { app?: Application; stage?: string; children: ReactNode; narrow?: boolean }) {
  const idx = STEP_STAGE[stage ?? app?.current_step ?? "intake"] ?? 0;
  return (
    <div className="min-h-dvh bg-mint">
      <header className="sticky top-0 z-30 border-b-2 border-ink/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Logo />
          <div className="flex items-center gap-2"><DemoBadge /><Link to="/garage" className="btn-ghost !min-h-[40px] !px-3 text-sm">Save &amp; exit</Link></div>
        </div>
        <nav aria-label="Application progress" className="mx-auto max-w-5xl overflow-x-auto px-4 pb-3 md:px-8">
          <ol className="flex min-w-max gap-1.5">
            {STAGES.map((s, i) => (
              <li key={s} aria-current={i === idx ? "step" : undefined}
                className={cx("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold", i < idx ? "bg-go-light text-go-dark" : i === idx ? "bg-ink text-white" : "bg-ink/5 text-ink-mute")}>
                {i < idx && <Check className="h-3 w-3" aria-hidden />}{s}
              </li>
            ))}
          </ol>
        </nav>
      </header>
      <div className={cx("mx-auto grid max-w-5xl gap-6 px-4 py-6 md:px-8", app && !narrow ? "lg:grid-cols-[1fr_300px]" : "")}>
        <main id="main" className="min-w-0">{children}</main>
        {app && !narrow && <Summary app={app} />}
      </div>
    </div>
  );
}

function Summary({ app }: { app: Application }) {
  const nav = useNavigate();
  const inv = useInvalidate();
  const cancel = useMutation({ mutationFn: () => api(`/applications/${app.id}/cancel`, { body: {} }), onSuccess: () => { inv("application", "applications"); nav(`/finance/${app.id}/recovery`); } });
  const closed = ["declined", "cancelled", "expired", "error", "disbursed"].includes(app.state);
  return (
    <aside aria-label="Application summary" className="hidden lg:block">
      <div className="card sticky top-32 space-y-4">
        <h2 className="text-base">Your application</h2>
        <Stat label="Vehicle" value={app.model?.label ?? "—"} />
        <div className="grid grid-cols-2 gap-3"><Stat label="Quote" value={inr(app.quote)} /><Stat label="Loan" value={inr(app.amount)} /></div>
        <div className="grid grid-cols-2 gap-3"><Stat label="You pay" value={inr(app.contribution)} /><Stat label="Tenure" value={`${app.tenure} mo`} /></div>
        <Stat label="Lender" value={<span className="text-base">{app.lender.name}</span>} sub="Makes the decision" />
        <Stat label="Status" value={<span className="text-base">{STATE_LABEL[app.state] ?? app.state}</span>} />
        {!closed && (
          <button className="btn-quiet w-full text-coral-dark" disabled={cancel.isPending} onClick={() => { if (confirm("Cancel this application? You can start a new one later.")) cancel.mutate(); }}>
            <X className="h-4 w-4" aria-hidden /> Cancel application
          </button>
        )}
      </div>
    </aside>
  );
}

export function WhoWhy({ lender, purpose }: { lender: string; purpose: string }) {
  return (
    <div className="rounded-2xl border-2 border-sky/40 bg-sky-light/60 p-4 text-sm font-bold">
      <p><span className="text-ink-mute">Who gets this:</span> <b>{lender}</b></p>
      <p className="mt-0.5"><span className="text-ink-mute">Why:</span> <b>{purpose}</b></p>
    </div>
  );
}
