import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Bell, RefreshCw, Trash2, Truck } from "lucide-react";
import { api, ApiError } from "@/api/client";
import { useInvalidate, useVehicle } from "@/api/hooks";
import type { Vehicle } from "@/api/types";
import { UploadField } from "@/components/UploadField";
import { Callout, cx, ErrorBox, PageHeader, Spinner, useToast } from "@/components/ui";
import { dateFmt, inr } from "@/lib/format";
import { EquityBlock } from "./parts";

export default function VehicleDetail() {
  const [sp] = useSearchParams();
  const { id = "" } = useParams();
  const { data: v, isLoading, error, refetch } = useVehicle(id);
  const inv = useInvalidate();
  const nav = useNavigate();
  const toast = useToast();
  const refresh = () => { inv("vehicle", "garage", "collection", "me", "insights"); };

  const valuation = useMutation({ mutationFn: () => api<Vehicle>(`/vehicles/${id}/valuation`, { body: {} }), onSuccess: () => { refresh(); toast("Valuation refreshed"); }, onError: (e) => toast((e as Error).message, "err") });
  const delivered = useMutation({ mutationFn: () => api(`/vehicles/${id}`, { method: "PATCH", body: { delivery_status: "delivered" } }), onSuccess: () => { refresh(); toast("Marked as delivered"); } });
  const remove = useMutation({ mutationFn: () => api(`/vehicles/${id}`, { method: "DELETE" }), onSuccess: () => { inv("garage", "vehicles"); nav("/garage"); } });

  if (isLoading) return <Spinner />;
  if (error || !v) return <ErrorBox error={error} retry={() => refetch()} />;

  return (
    <>
      <PageHeader back={<Link to="/garage" className="mb-2 inline-flex items-center gap-1 text-sm font-extrabold text-ink-soft"><ArrowLeft className="h-4 w-4" /> Garage</Link>}
        title={v.label} sub={`${v.year} · ${v.type}${v.variant ? ` · ${v.variant}` : ""}${v.city ? ` · ${v.city}` : ""}${v.verified_model ? "" : " · unverified model"}`} />
      {v.delivery_status === "pending" && (
        <div className="mb-5"><Callout tone="info" title="Delivery pending">
          <span className="flex flex-wrap items-center gap-3">Your loan was disbursed to the dealer. Disbursal is not delivery: this stays pending until you have the vehicle.
            <button className="btn-ghost" onClick={() => delivered.mutate()}><Truck className="h-4 w-4" aria-hidden /> I've got it</button></span>
        </Callout></div>
      )}
      <Tabs.Root defaultValue={sp.get("tab") === "care" ? "care" : "overview"}>
        <Tabs.List className="mb-5 flex gap-2" aria-label="Vehicle sections">
          {["overview", "care", "history"].map((t) => (
            <Tabs.Trigger key={t} value={t} className="min-h-[44px] rounded-2xl border-2 border-ink/15 bg-white px-5 font-extrabold capitalize data-[state=active]:border-go data-[state=active]:bg-go data-[state=active]:text-white">{t}</Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="overview" className="grid gap-5 md:grid-cols-2">
          {v.ownership === "current" ? (
            <section className="card space-y-4" aria-label="Value and equity">
              <h2 className="text-lg">Value &amp; equity</h2>
              <EquityBlock v={v} big />
              <div className="flex flex-wrap gap-2">
                {v.verified_model && <button className="btn-ghost" onClick={() => valuation.mutate()} disabled={valuation.isPending}><RefreshCw className="h-4 w-4" aria-hidden /> Refresh value</button>}
                <Link to="/explore" className="btn-ghost">Explore your next vehicle</Link>
              </div>
              {valuation.error instanceof ApiError && <p className="err" role="alert">{valuation.error.message}</p>}
            </section>
          ) : <section className="card"><p className="font-semibold text-ink-soft">You owned this before. Past ownership is self-reported.</p></section>}
          {v.ownership === "current" && <LoanForm v={v} onSaved={refresh} />}
        </Tabs.Content>

        <Tabs.Content value="care"><CareTab v={v} onSaved={refresh} /></Tabs.Content>

        <Tabs.Content value="history">
          <section className="card">
            <h2 className="mb-3 text-lg">Details &amp; history</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              {[["Year", v.year], ["Ownership", v.ownership === "current" ? "Current" : "Past"], ["Odometer", v.odometer != null ? `${v.odometer.toLocaleString("en-IN")} km` : "—"],
                ["Condition", v.condition ?? "—"], ["Owners", v.owners ?? "—"], ["Accident", v.accident_flag == null ? "—" : v.accident_flag ? "Yes" : "No"],
                ["Modified", v.modified_flag == null ? "—" : v.modified_flag ? "Yes" : "No"], ["Added via", v.source === "finance_handoff" ? "Finance handoff" : "Manual"]]
                .map(([k, val]) => <div key={k as string}><dt className="font-extrabold uppercase text-ink-mute text-xs">{k}</dt><dd className="font-black capitalize">{val}</dd></div>)}
            </dl>
            <h3 className="mb-2 mt-6 text-base">Service history</h3>
            {v.care?.length ? <ul className="space-y-2">{v.care.map((c) => <li key={c.id} className="flex justify-between rounded-xl bg-mint px-3 py-2 text-sm font-bold"><span>{c.kind}</span><span>{dateFmt(c.date)} · {c.odometer.toLocaleString("en-IN")} km</span></li>)}</ul>
              : <p className="text-sm font-semibold text-ink-soft">No service logged yet.</p>}
            <button className="btn-quiet mt-6 text-coral-dark" onClick={() => { if (confirm("Remove this vehicle from your garage?")) remove.mutate(); }}><Trash2 className="h-4 w-4" aria-hidden /> Remove from garage</button>
          </section>
        </Tabs.Content>
      </Tabs.Root>
    </>
  );
}

function LoanForm({ v, onSaved }: { v: Vehicle; onSaved: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<string>(v.loan.source === "not_provided" ? "" : v.loan.status);
  const [lender, setLender] = useState(v.loan.lender ?? "");
  const [principal, setPrincipal] = useState(v.loan.principal != null ? String(v.loan.principal) : "");
  const [sdate, setSdate] = useState(v.loan.statement_date ?? "");
  const [docId, setDocId] = useState<string | undefined>();
  const [errs, setErrs] = useState<Record<string, string>>({});
  const today = new Date().toISOString().slice(0, 10);

  const save = useMutation({
    mutationFn: () => api<Vehicle>(`/vehicles/${v.id}/loan`, { method: "PUT", body: {
      status, lender: lender || null, principal: principal ? Number(principal) : null, statement_date: sdate || null, document_id: docId ?? null } }),
    onSuccess: () => { onSaved(); toast("Loan details saved"); setErrs({}); },
    onError: (e) => setErrs(e instanceof ApiError ? { [e.field ?? "form"]: e.message } : { form: "Couldn't save" }),
  });

  return (
    <section className="card space-y-4" aria-label="Loan details">
      <h2 className="text-lg">Loan on this vehicle</h2>
      <p className="text-sm font-semibold text-ink-soft">Prefer a statement from your lender. Bureau balances can lag, and bank debits don't show your outstanding principal.</p>
      <fieldset>
        <legend className="label">Is there a loan?</legend>
        <div className="grid grid-cols-3 gap-2">
          {[["none", "No loan"], ["active", "Yes, active"], ["unknown", "Not sure"]].map(([val, l]) => (
            <button key={val} type="button" aria-pressed={status === val} onClick={() => setStatus(val)}
              className={cx("min-h-[44px] rounded-2xl border-2 text-sm font-extrabold", status === val ? "border-go bg-go text-white" : "border-ink/15 bg-white")}>{l}</button>
          ))}
        </div>
      </fieldset>
      {status === "active" && (
        <>
          <div><label className="label" htmlFor="lender">Lender</label><input id="lender" className={cx("input", errs.lender && "input-err")} value={lender} onChange={(e) => setLender(e.target.value)} />{errs.lender && <p className="err" role="alert">{errs.lender}</p>}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="principal">Principal outstanding (₹)</label><input id="principal" className={cx("input", errs.principal && "input-err")} inputMode="numeric" value={principal} onChange={(e) => setPrincipal(e.target.value.replace(/\D/g, ""))} />{errs.principal && <p className="err" role="alert">{errs.principal}</p>}</div>
            <div><label className="label" htmlFor="sdate">Statement date</label><input id="sdate" type="date" max={today} className={cx("input", errs.statement_date && "input-err")} value={sdate} onChange={(e) => setSdate(e.target.value)} />{errs.statement_date && <p className="err" role="alert">{errs.statement_date}</p>}</div>
          </div>
          <UploadField id="loan-stmt" kind="loan_statement" label="Loan statement (optional)" vehicleId={v.id} onChange={(d) => setDocId(d)} hint="We read principal and date from it when we can." />
        </>
      )}
      {errs.form && <p className="err" role="alert">{errs.form}</p>}
      <button className="btn-go" disabled={!status || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save loan details"}</button>
    </section>
  );
}

const SERVICES = ["General service", "Oil change", "Tyres", "Brakes", "Chain / belt", "Battery", "Insurance renewal", "PUC", "Other"];
function CareTab({ v, onSaved }: { v: Vehicle; onSaved: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState(SERVICES[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [odo, setOdo] = useState(v.odometer != null ? String(v.odometer) : "");
  const [cost, setCost] = useState("");
  const [next, setNext] = useState("");
  const [notes, setNotes] = useState("");
  const [remind, setRemind] = useState(false);
  const [doc, setDoc] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => api(`/vehicles/${v.id}/care`, { body: { kind, date, odometer: Number(odo), cost: cost ? Number(cost) : null, next_due: next || null, notes: notes || null, remind, document_id: doc ?? null } }),
    onSuccess: () => { onSaved(); toast("Service logged"); setNext(""); setNotes(""); setCost(""); setErr(null); },
    onError: (e) => setErr((e as Error).message),
  });

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className="card space-y-4">
        <h2 className="text-lg">Log a service or task</h2>
        <div><label className="label" htmlFor="ckind">What was done?</label><select id="ckind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="cdate">Date</label><input id="cdate" type="date" className="input" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="label" htmlFor="codo">Odometer (km)</label><input id="codo" className="input" inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value.replace(/\D/g, ""))} /></div>
          <div><label className="label" htmlFor="ccost">Cost (₹, optional)</label><input id="ccost" className="input" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))} /></div>
          <div><label className="label" htmlFor="cnext">Next due (optional)</label><input id="cnext" type="date" className="input" min={date} value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <div><label className="label" htmlFor="cnotes">Notes (optional)</label><input id="cnotes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></div>
        <UploadField id="care-bill" kind="care_bill" label="Bill (optional)" vehicleId={v.id} onChange={(d) => setDoc(d)} compact />
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink/15 p-3 font-bold">
          <input type="checkbox" className="h-5 w-5 accent-go" checked={remind} onChange={(e) => setRemind(e.target.checked)} /> <Bell className="h-4 w-4" aria-hidden /> Remind me near the due date
        </label>
        <p className="help">Regular care may help protect condition. It doesn't guarantee a higher resale price.</p>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn-go" disabled={!odo || add.isPending} onClick={() => add.mutate()}>{add.isPending ? "Saving…" : "Save entry"}</button>
      </section>
      <section className="card">
        <h2 className="mb-3 text-lg">Timeline</h2>
        {v.care?.length ? (
          <ol className="space-y-3">
            {v.care.map((c) => (
              <li key={c.id} className="rounded-2xl border-2 border-ink/10 p-3">
                <p className="font-black">{c.kind}</p>
                <p className="text-sm font-bold text-ink-soft">{dateFmt(c.date)} · {c.odometer.toLocaleString("en-IN")} km{c.cost != null && ` · ${inr(c.cost)}`}</p>
                {c.next_due && <p className="text-sm font-extrabold text-sun-dark">Next due {dateFmt(c.next_due)}{c.remind && " · reminder on"}</p>}
              </li>
            ))}
          </ol>
        ) : <p className="font-semibold text-ink-soft">Nothing yet. Your first entry starts the timeline.</p>}
      </section>
    </div>
  );
}
