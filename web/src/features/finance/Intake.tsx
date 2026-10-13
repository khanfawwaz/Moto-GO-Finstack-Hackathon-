import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { useGarage, useGoals, useIntakeSpec, useMe } from "@/api/hooks";
import type { Application } from "@/api/types";
import { DynamicForm } from "@/components/DynamicForm";
import { Callout, ErrorBox, Spinner } from "@/components/ui";
import { inr } from "@/lib/format";
import { FinanceFrame, WhoWhy } from "./Frame";
import { useEffect } from "react";

export default function Intake() {
  const [sp] = useSearchParams();
  const goalId = sp.get("goal");
  const nav = useNavigate();
  const { data: me, isLoading: l0 } = useMe();
  const { data: spec, isLoading, error, refetch } = useIntakeSpec();
  const goalsQuery = useGoals();
  const goals = goalsQuery.data;
  const garageQuery = useGarage();
  const goal = goals?.items.find((g) => g.id === goalId);
  const [serverError, setServerError] = useState<unknown>();
  const [idem] = useState(() => crypto.randomUUID());

  useEffect(() => { if (!l0 && !me) nav("/signup", { replace: true, state: { next: `/finance/start${goalId ? `?goal=${goalId}` : ""}`, reason: "Sign in to start a financing application." } }); }, [l0, me, nav, goalId]);

  if (isLoading || l0 || (goalId && (goalsQuery.isLoading || garageQuery.isLoading))) return <FinanceFrame stage="intake" narrow><Spinner /></FinanceFrame>;
  if (goalId && (goalsQuery.error || garageQuery.error || !goal)) return <FinanceFrame stage="intake" narrow><ErrorBox error={goalsQuery.error || garageQuery.error || new Error("This ownership plan could not be loaded.")} /></FinanceFrame>;
  if (error || !spec) return <FinanceFrame stage="intake" narrow><ErrorBox error={error} retry={() => refetch()} /></FinanceFrame>;

  const quote = goal?.price_assumption ?? undefined;
  const vehicle = garageQuery.data?.vehicles.find(v => v.id === goal?.sell_current);
  const payoff = vehicle?.loan.status === "none" ? 0 : vehicle?.loan.principal;
  const equity = vehicle?.valuation && payoff != null ? vehicle.valuation.mid - payoff - 3000 : 0;
  const contribution = goal && quote != null ? Math.max(0, Math.min(goal.savings + equity, quote)) : undefined;
  if (goal?.sell_current && (!vehicle?.valuation || !vehicle.equity.known)) return <FinanceFrame stage="intake" narrow><ErrorBox error={new Error("Update the selected vehicle's valuation and loan balance in Garage before using its sale proceeds.")} /></FinanceFrame>;
  const defaults = {
    model_id: goal?.target_model?.type !== "car" ? goal?.target_model?.id : undefined, new_or_used: "new", city: me?.profile?.city ?? "",
    quote, contribution, amount: quote != null && contribution != null ? quote - contribution : undefined, tenure: ["12", "24", "36", "48"].includes(sp.get("tenure") ?? "") ? sp.get("tenure")! : "36",
  };

  const submit = async (values: Record<string, unknown>) => {
    setServerError(undefined);
    try {
      const app = await api<Application>("/applications", { body: { goal_id: goal?.id ?? null, values }, idem });
      nav(`/finance/${app.id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && ["unsupported_applicant", "unsupported_vehicle"].includes(e.code))
        nav(`/finance/blocked?reason=${e.code}&msg=${encodeURIComponent(e.message)}`);
      else setServerError(e);
    }
  };

  return (
    <FinanceFrame stage="intake" narrow>
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <p className="chip bg-ink/10 text-ink-soft">{spec.screen} · Start</p>
          <h1 className="mt-2 text-2xl sm:text-3xl">{spec.title}</h1>
          <p className="mt-1 font-semibold text-ink-soft">{spec.intro}</p>
        </div>
        <WhoWhy lender={spec.lender.name} purpose={spec.purpose} />
        {goal && <Callout title="From your ownership plan">{goal.target_model?.label} · price {inr(goal.price_assumption)} · cash down payment {inr(goal.savings)}{vehicle && <> · estimated sale {inr(vehicle.valuation?.mid ?? 0)} · loan payoff {inr(payoff ?? 0)} · transfer costs ₹3,000</>}. These estimates are editable below.</Callout>}
        <Callout tone="ok" title="No credit check happens here">Your garage, collection and plans stay exactly as they are. You can stop at any point and pick up later, on any device.</Callout>
        <div className="card"><DynamicForm spec={spec} defaults={defaults} onSubmit={submit} serverError={serverError} submitLabel="Start my application" /></div>
      </div>
    </FinanceFrame>
  );
}
