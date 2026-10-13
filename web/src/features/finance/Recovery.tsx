import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { HeartHandshake } from "lucide-react";
import { api } from "@/api/client";
import { useApplication, useInvalidate } from "@/api/hooks";
import { Spinner } from "@/components/ui";
import { inr } from "@/lib/format";
import { FinanceFrame } from "./Frame";

interface Copy { title: string; body: string; resume?: string }

/** X01: one recovery screen for every blocked state, always with a way forward. */
export default function Recovery() {
  const { id: paramId } = useParams();
  const [sp] = useSearchParams();
  const id = paramId ?? sp.get("id") ?? undefined;
  const nav = useNavigate();
  const inv = useInvalidate();
  const { data: app, isLoading } = useApplication(id ?? "");
  const reason = sp.get("reason") ?? app?.state ?? "error";
  const resume = sp.get("resume") ?? undefined;
  const cancel = useMutation({ mutationFn: () => api(`/applications/${id}/cancel`, { body: {} }), onSuccess: () => { inv("application", "applications"); nav("/garage"); } });

  if (id && isLoading) return <FinanceFrame><Spinner /></FinanceFrame>;

  const COPY: Record<string, Copy> = {
    declined: { title: "The lender couldn't approve this request", body: app?.exit_reason ?? "The lender decided not to approve this request." },
    cancelled: { title: "This application was stopped", body: app?.exit_reason ?? "The application was cancelled." },
    expired: { title: "This application expired", body: "Offers and drafts only last a limited time. You can start again, and your answers on this device's account are kept for pre-filling." },
    error: { title: "Something on our side needs a look", body: "This application hit a problem we couldn't resolve automatically. Nothing is lost, and support can see where it stopped." },
    bureau_declined: { title: "We can't continue without the credit report", body: "That's completely fine. The lender needs your consent to fetch a credit report before it can decide. Your application is saved, and you can pick it up whenever you're ready.", resume: "Resume at the credit report step" },
    unsupported_applicant: { title: "This lender can't finance that yet", body: sp.get("msg") ?? "The lender doesn't support this applicant type in the pilot." },
    unsupported_vehicle: { title: "This lender can't finance that vehicle yet", body: sp.get("msg") ?? "Only two-wheelers can be financed in this release." },
  };
  const c = COPY[reason] ?? COPY.error;
  const canResume = !!id && (reason === "bureau_declined" || reason === "error");

  return (
    <FinanceFrame app={app} stage="recovery" narrow>
      <div className="mx-auto max-w-lg space-y-5 py-4">
        <div className="card space-y-4 !p-7">
          <HeartHandshake className="h-10 w-10 text-sky-dark" aria-hidden />
          <h1 className="text-2xl sm:text-3xl">{c.title}</h1>
          <p className="font-semibold text-ink-soft">{c.body}</p>
          {app && reason === "declined" && <p className="text-sm font-bold text-ink-mute">You asked for {inr(app.amount)}. Smaller amounts may be treated differently, so you can adjust the numbers in your plan and try again.</p>}
          <p className="rounded-2xl bg-go-light/50 p-3 text-sm font-bold text-go-dark">Your garage, collection and plans are unaffected. Finance outcomes are never used for anything else in the app.</p>
          <div className="flex flex-col gap-3">
            {canResume && <Link to={`/finance/${id}${resume ? `/step/${resume}` : ""}`} className="btn-go">{c.resume ?? "Resume where I left off"}</Link>}
            <Link to="/roadmap" className={canResume ? "btn-ghost" : "btn-go"}>Back to my plan</Link>
            <Link to="/garage" className="btn-ghost">Go to my Garage</Link>
            {id && reason === "bureau_declined" && <button className="btn-quiet text-coral-dark" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Cancel this application</button>}
          </div>
        </div>
        <p className="text-center text-sm font-bold text-ink-mute">Need help? Support can see exactly where your application stopped.</p>
      </div>
    </FinanceFrame>
  );
}
