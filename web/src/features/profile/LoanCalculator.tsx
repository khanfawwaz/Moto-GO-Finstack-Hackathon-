import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useGoals, useInvalidate, usePassport } from "@/api/hooks";
import type { Goal, Model, Vehicle, VType } from "@/api/types";
import { ModelPicker } from "@/components/ModelPicker";
import { VehicleImage } from "@/components/VehicleImage";
import { ErrorBox } from "@/components/ui";
import { inr } from "@/lib/format";

export function LoanCalculator({ vehicles }: { vehicles: Vehicle[] }) {
  const [sp] = useSearchParams();
  const [type, setType] = useState<VType | "">("");
  const [model, setModel] = useState<Model | null>(null);
  const [price, setPrice] = useState(300000);
  const [cash, setCash] = useState(60000);
  const [rate, setRate] = useState(11.5);
  const [months, setMonths] = useState(36);
  const [saleId, setSaleId] = useState("");
  const { data: goals, isLoading: goalsLoading } = useGoals();
  const requested = usePassport(sp.get("model") ?? "");
  const qc = useQueryClient();
  useEffect(() => {
    if (!requested.data || goalsLoading) return;
    const selected = requested.data.model;
    const goal = goals?.items.find(g => g.target_model?.id === selected.id && (!sp.get("goal") || g.id === sp.get("goal")));
    const quote = goal?.price_assumption ?? Math.round((selected.price_low + selected.price_high) / 2);
    setModel(selected); setPrice(quote); setCash(goal?.savings ?? Math.round(quote * .2)); setSaleId(goal?.sell_current ?? "");
    const requestedRate = Number(sp.get("rate") ?? 11.5);
    setRate(Number.isFinite(requestedRate) ? Math.max(0, Math.min(40, requestedRate)) : 11.5);
    const requestedMonths = Number(sp.get("tenure") ?? 36);
    setMonths([12,24,36,48].includes(requestedMonths) ? requestedMonths : 36);
  }, [requested.data?.model.id, goalsLoading]);
  const nav = useNavigate();
  const inv = useInvalidate();
  const sale = vehicles.find(v => v.id === saleId);
  const currentVehicle = sale ?? vehicles[0];
  const known = !sale || (!!sale.valuation && sale.equity.known);
  const payoff = sale?.loan.status === "none" ? 0 : sale?.loan.principal;
  const proceeds = sale?.valuation && payoff != null ? sale.valuation.mid - payoff - 3000 : 0;
  const principal = Math.max(0, price - cash - proceeds);
  const r = rate / 1200;
  const factor = (1 + r) ** months;
  const emi = principal ? Math.round(r ? principal * r * factor / (factor - 1) : principal / months) : 0;
  const save = useMutation({
    mutationFn: () => {
      const goal = goals?.items.find(g => g.target_model?.id === model?.id);
      return api<Goal>(goal ? `/goals/${goal.id}` : "/goals", { method: goal ? "PATCH" : "POST", body: { target_model_id: model!.id, price_assumption: price, savings: cash, sell_current: saleId || null } });
    },
    onSuccess: goal => {
      qc.setQueryData<{ items: Goal[] }>(["goals"], old => ({ items: [...(old?.items ?? []).filter(g => g.id !== goal.id), goal] }));
      inv("garage"); nav(`/explore?eligibility=${model!.id}&goal=${goal.id}&rate=${rate}&tenure=${months}#eligibility`);
    },
  });
  return <div id="emi-calculator" className="card grid scroll-mt-28 items-start gap-6 !p-5 lg:grid-cols-2">
    <section className="min-w-0 space-y-4" aria-labelledby="calculator-title">
      <h2 id="calculator-title" className="text-2xl">EMI calculator</h2>
      <div className="rounded-xl border border-go/30 bg-go-light p-5"><p className="text-xs font-bold uppercase text-go-dark">Estimated EMI</p><p className="mt-1 text-4xl font-black text-go-dark" aria-live="polite">{known ? inr(emi) : "Unknown"}<span className="ml-2 text-sm">per month*</span></p><p className="mt-2 text-sm text-ink-soft">{model?.label ?? "Choose a vehicle on the right to save your plan"}</p></div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {[["Vehicle price (₹)", price, setPrice], ["Cash down payment (₹)", cash, setCash], ["Annual interest (%)", rate, setRate]].map(([label, value, on], i) => <label key={String(label)} className="!mb-0 text-xs font-bold text-ink-soft">{String(label)}<input className="input mt-1 !min-h-[40px] !py-2" type="number" min="0" max={i === 2 ? 40 : 50000000} step={i === 2 ? ".1" : "1000"} value={value as number} onChange={e => (on as (n:number) => void)(Math.max(0, Math.min(i === 2 ? 40 : 50000000, Number(e.target.value))))} /></label>)}
        <label className="text-xs font-bold text-ink-soft">Tenure<select aria-label="Tenure" className="input mt-1 !min-h-[40px] !py-2" value={months} onChange={e => setMonths(Number(e.target.value))}>{[12,24,36,48].map(n => <option key={n} value={n}>{n} months</option>)}</select></label>
      </div>
      <p className="text-sm text-ink-soft">Amount to finance: <strong className="text-ink">{known ? inr(principal) : "Unknown"}</strong></p>
      <p className="text-xs leading-relaxed text-ink-mute">*Reducing-balance estimate; lender fees excluded. Include registration/insurance in your vehicle price. Offers may differ. Calculating an EMI does not check your credit.</p>
      <button className="btn-go w-full" disabled={!model || !known || save.isPending || goalsLoading || principal < 10000 || principal > price} onClick={() => save.mutate()}>{save.isPending ? "Saving plan…" : "Explore financing"}</button>
      {principal < 10000 && <p className="text-xs text-sun-dark">Minimum loan: ₹10,000.</p>}{principal > price && <p className="text-xs text-sun-dark">Add cash to cover your existing loan shortfall.</p>}
      {save.error && <ErrorBox error={save.error} />}
    </section>
    <section className="min-w-0 space-y-3 border-t border-ink/15 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-labelledby="plan-title">
      <h2 id="plan-title" className="text-xl">Choose a vehicle to save this plan</h2>
      <label className="text-xs font-bold text-ink-soft">Vehicle type for plan<select className="input mt-1" value={type} onChange={e => setType(e.target.value as VType | "")}><option value="">Cars, bikes & scooters</option><option value="car">Cars</option><option value="bike">Bikes</option><option value="scooter">Scooters</option></select></label>
      <div><label htmlFor="calculator-model" className="label">Search vehicles</label><ModelPicker key={type} id="calculator-model" compact type={type || undefined} value={model?.id} placeholder="Search a car or bike by make or model" onPick={m => { setModel(m); const quote = Math.round((m.price_low + m.price_high)/2); setPrice(quote); setCash(Math.round(quote*.2)); }} /></div>
      {requested.error && <ErrorBox error={requested.error} />}
      {model && <p className="text-sm font-bold text-go-dark">Selected: {model.label}</p>}
      <div className="space-y-3 border-t border-ink/15 pt-4">
        <h3 className="text-lg">Include current vehicle</h3>
        {currentVehicle ? <>
          <div className="flex items-center gap-3 rounded-xl border border-ink/15 p-2"><VehicleImage id={currentVehicle.model?.id} label={currentVehicle.label} type={currentVehicle.type} className="h-14 w-20 shrink-0 rounded-lg object-cover" /><div className="min-w-0"><p className="font-bold">{currentVehicle.label} · {currentVehicle.year}</p><p className="text-xs text-ink-soft">Estimated value: {currentVehicle.valuation ? inr(currentVehicle.valuation.mid) : "Not available"}</p></div></div>
          <label className="block text-xs font-bold text-ink-soft">Use sale proceeds (optional)<select className="input mt-1 !min-h-[40px] !py-2" aria-label="Vehicle to sell" value={saleId} onChange={e => setSaleId(e.target.value)}><option value="">Keep my current vehicles</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.label} ({v.year})</option>)}</select></label>
          {sale && <p className="text-xs text-ink-soft">{known ? `Sale ${inr(sale.valuation!.mid)} − loan ${inr(payoff ?? 0)} − ₹3,000 costs = ${inr(proceeds)} available.` : "Confirm valuation and loan balance in Garage first."}</p>}
        </> : <p className="text-xs text-ink-mute">Add your current vehicle in Garage to include its sale proceeds. This is optional.</p>}
      </div>
    </section>
  </div>;
}
