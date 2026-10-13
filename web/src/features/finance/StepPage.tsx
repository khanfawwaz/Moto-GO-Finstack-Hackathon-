import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/api/client";
import { useApplication, useApplicationStream, useStepSpec } from "@/api/hooks";
import type { Application, StepSpec } from "@/api/types";
import { DynamicForm } from "@/components/DynamicForm";
import { Callout, ErrorBox, Spinner } from "@/components/ui";
import { inr } from "@/lib/format";
import { useInvalidate } from "@/api/hooks";
import { FinanceFrame, WhoWhy } from "./Frame";

const ORDER = ["identity", "kyc", "bureau", "evidence", "work", "vehicle"];

export default function StepPage() {
  const { id = "", step = "" } = useParams();
  const nav = useNavigate();
  const inv = useInvalidate();
  const { data: app, error: appErr } = useApplication(id);
  const { data: spec, error: specErr, refetch } = useStepSpec(id, step);
  useApplicationStream(id);
  const [serverError, setServerError] = useState<unknown>();
  const [idem, setIdem] = useState(() => crypto.randomUUID());

  // keep the user on the right page: closed applications and moved-on states go back to the router
  useEffect(() => {
    if (!app) return;
    const closed = ["declined", "cancelled", "expired", "error"].includes(app.state);
    const waitingMandate = step === "mandate" && app.state === "mandate_pending";
    if (closed) nav(`/finance/${id}/recovery`, { replace: true });
    else if (step === "mandate" && app.mandate_active) nav(`/finance/${id}`, { replace: true });
    else if (!waitingMandate && app.current_step !== step && ["remediation", "status", "offers", "disbursal", "handoff"].includes(app.current_step)) nav(`/finance/${id}`, { replace: true });
  }, [app, step, id, nav]);

  if (appErr || specErr) return <FinanceFrame app={app} stage={step}><ErrorBox error={appErr ?? specErr} retry={() => refetch()} /></FinanceFrame>;
  if (!app || !spec) return <FinanceFrame app={app} stage={step}><Spinner /></FinanceFrame>;

  if (step === "mandate" && app.state === "mandate_pending" && !app.mandate_active) return <FinanceFrame app={app} stage={step}><Waiting title="Waiting for your bank" body="We've sent the repayment mandate. This usually takes a few seconds, and you can leave this page: we'll pick up where you left off." /></FinanceFrame>;

  const idx = ORDER.indexOf(step);
  const save = (submit: boolean) => async (values: Record<string, unknown>) => {
    setServerError(undefined);
    try {
      const r = await api<{ application: Application; redirect: { url: string } | null }>(`/applications/${id}/steps/${step}`, {
        method: "PUT", body: { values, submit }, idem: submit ? idem : undefined,
      });
      if (!submit) return;
      inv("application", "applications", "insights");
      if (r.redirect) nav(r.redirect.url);
      else nav(`/finance/${id}`);
    } catch (e) {
      if (submit) { setServerError(e); setIdem(crypto.randomUUID()); }
      if (e instanceof ApiError && ["requirements_open", "application_closed", "step_out_of_order"].includes(e.code)) nav(`/finance/${id}`);
    }
  };

  return (
    <FinanceFrame app={app} stage={step}>
      <div className="space-y-5">
        <div>
          <p className="chip bg-ink/10 text-ink-soft">{spec.screen}{idx >= 0 && ` · Step ${idx + 1} of ${ORDER.length}`}</p>
          <h1 className="mt-2 text-2xl sm:text-3xl">{spec.title}</h1>
          <p className="mt-1 font-semibold text-ink-soft">{spec.intro}</p>
        </div>
        <WhoWhy lender={spec.lender.name} purpose={spec.purpose} />
        {step === "esign" && <Agreement app={app} />}
        {step === "kyc" && <Callout tone="info">Only the items the lender flags as missing are asked for later. A check you've passed is never repeated.</Callout>}
        <div className="card">
          <DynamicForm key={`${step}-${spec.status}`} spec={spec as StepSpec} applicationId={id} onDraft={save(false)} onSubmit={save(true)} serverError={serverError}
            submitLabel={step === "esign" ? "Continue to sign" : step === "mandate" ? "Set up repayments" : step === "vehicle" ? "Send to lender" : step === "evidence" ? "Continue" : "Save and continue"}
            extraActions={step === "bureau" ? (
              <button type="button" className="btn-ghost" onClick={() => nav(`/finance/blocked?reason=bureau_declined&id=${id}&resume=bureau`)}>No thanks</button>
            ) : undefined} />
        </div>
        <p className="text-center text-sm font-bold text-ink-mute">Progress saves automatically. <Link to="/garage" className="underline">Save &amp; exit</Link> any time.</p>
      </div>
    </FinanceFrame>
  );
}

function Agreement({ app }: { app: Application }) {
  return (
    <div className="card space-y-2 bg-white">
      <h2 className="text-base">Agreement summary</h2>
      <p className="font-semibold text-ink-soft">Loan of <b>{inr(app.amount)}</b> over <b>{app.tenure} months</b> from <b>{app.lender.name}</b> for the {app.model?.label}. The loan is paid directly to the dealer. Moto Go never holds your funds.</p>
      <Link to={`/finance/${app.id}/offers`} className="text-sm font-extrabold text-sky-dark underline">Review the offer and Key Facts Statement again</Link>
    </div>
  );
}

export function Waiting({ title, body }: { title: string; body: string }) {
  return (
    <div role="status" className="card mx-auto max-w-lg space-y-3 py-10 text-center">
      <Loader2 className="mx-auto h-10 w-10 animate-spin text-go-dark" aria-hidden />
      <h1 className="text-2xl">{title}</h1>
      <p className="font-semibold text-ink-soft">{body}</p>
    </div>
  );
}
