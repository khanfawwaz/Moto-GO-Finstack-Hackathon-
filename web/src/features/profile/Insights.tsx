import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useApplications, useGarage, useGoals, useOffers } from "@/api/hooks";
import type { Application } from "@/api/types";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { dateFmt, inr, inrRange } from "@/lib/format";
import { STATE_LABEL } from "../finance/Frame";
import { LoanCalculator } from "./LoanCalculator";
import { ExternalOnboardingStatus } from "../finance/ExternalOnboarding";

type FinancialProfile = { application_id: string; declared_monthly_income: number | null; declared_existing_emis: number | null; employment: string | null; identity_status: string; kyc_status: string };

export default function Insights() {
  const garage = useGarage();
  const apps = useApplications();
  const goals = useGoals();
  const insights = useQuery({ queryKey: ["insights"], queryFn: () => api<{ financial_profiles: FinancialProfile[] }>("/insights") });
  if (garage.isLoading) return <Spinner label="Loading your loans" />;
  if (garage.error) return <ErrorBox error={garage.error} retry={() => garage.refetch()} />;
  if (!garage.data) return <ErrorBox error={new Error("Your account information could not be loaded.")} />;
  const current = garage.data.vehicles.filter(v => v.ownership === "current");
  const valued = current.filter(v => v.valuation);
  const totalValue = valued.length ? inrRange(valued.reduce((n,v) => n+v.valuation!.low,0), valued.reduce((n,v) => n+v.valuation!.high,0)) : "Not valued yet";
  return <div className="space-y-4 [&>header]:!mb-2">
    <PageHeader title="Loans" sub="Vehicle finance, insurance and your next EMI." action={<Link to="/settings" className="btn-ghost !min-h-[40px] text-sm">Settings</Link>} />
    <ExternalOnboardingStatus />
    <section aria-label="Financial overview" className="grid grid-cols-3 gap-2">{[["Owned vehicles", String(current.length)], ["Estimated value", totalValue], ["Estimated equity", garage.data.total_equity ? inrRange(garage.data.total_equity.low, garage.data.total_equity.high) : "Unknown"]].map(([label,value]) => <div key={label} className="card !p-3"><p className="text-[10px] font-bold uppercase text-ink-mute sm:text-xs">{label}</p><p className="mt-1 break-words text-base font-black sm:text-xl">{value}</p></div>)}</section>
    {(valued.length < current.length || garage.data.total_equity?.counted !== current.length) && !!current.length && <p className="!mt-1 text-xs text-ink-mute">Totals include known values and debt only; unknown balances aren't zero.</p>}
    <div className="space-y-4">
      <section className="space-y-2" aria-labelledby="vehicle-finance"><h2 id="vehicle-finance" className="text-xl">Loans & insurance</h2>
        {!current.length ? <div className="card !p-4"><Link to="/garage/add" className="btn-ghost">Add your first vehicle</Link></div> : current.map((v,i) => {
          const renewal = v.reminders?.find(r => r.kind === "Insurance renewal");
          const loan = v.loan.status === "none" ? "No active loan" : v.loan.status === "active" && v.loan.principal != null ? inr(v.loan.principal) : "Balance unknown";
          return <details key={v.id} className="card !p-3" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-3"><VehicleImage id={v.model?.id} label={v.label} type={v.type} className="h-12 w-16 shrink-0 rounded-lg object-cover" /><span className="min-w-0 flex-1"><span className="block text-lg font-black">{v.label} <span className="text-xs text-ink-mute">{v.year}</span></span><span className="block text-sm font-bold text-go-dark">Loan: {loan}</span><span className="block text-xs text-sun-dark">Insurance reminder: {renewal ? dateFmt(renewal.due) : "Not set"}</span></span><span className="text-ink-mute" aria-hidden>⌄</span></summary>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-ink/10 pt-3">{[["Estimated value", v.valuation ? inrRange(v.valuation.low,v.valuation.high) : "Not valued"], ["Equity", v.equity.known ? inrRange(v.equity.low,v.equity.high) : "Unknown"]].map(([label,value]) => <div key={label}><dt className="text-[10px] font-bold uppercase text-ink-mute">{label}</dt><dd className="text-sm font-bold">{value}</dd></div>)}</dl>
            <p className="mt-2 text-[11px] text-ink-mute">Loan source: {v.loan.source.replace(/_/g," ")}. Insurance policy/premium not collected; reminder doesn't verify coverage.</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"><Link to={`/garage/${v.id}`} className="font-bold text-go-dark underline">Vehicle & loan details</Link><Link to={`/garage/${v.id}?tab=care`} className="font-bold text-sun-dark underline">Insurance & service reminders</Link></div>
          </details>;
        })}
      </section>
      <LoanCalculator vehicles={current} />
    </div>
    <section className="space-y-2"><h2 className="text-xl">Applications & lender offers</h2>{apps.error ? <ErrorBox error={apps.error} retry={() => apps.refetch()} /> : apps.isLoading ? <Spinner /> : apps.data?.items.length ? apps.data.items.map(app => <ApplicationSummary key={app.id} app={app} profile={insights.data?.financial_profiles.find(p => p.application_id === app.id)} />) : <p className="text-sm text-ink-soft">No application yet. Use Explore financing to start; offers appear after assessment.</p>}{insights.error && <ErrorBox error={insights.error} retry={() => insights.refetch()} />}</section>
    <details className="rounded-xl border border-ink/15 px-3 py-2"><summary className="cursor-pointer text-sm font-bold">Saved ownership plans {goals.data ? `(${goals.data.items.length})` : ""}</summary><div className="mt-2 space-y-2">{goals.error ? <ErrorBox error={goals.error} /> : goals.isLoading ? <Spinner /> : goals.data?.items.length ? goals.data.items.map(g => <Link key={g.id} to={`/ownership/${g.id}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-ink/10 p-2 text-sm"><span className="font-black">{g.target_model?.label ?? "Vehicle"}</span><span className="text-ink-soft">Price {inr(g.price_assumption)} · cash {inr(g.savings)} →</span></Link>) : <p className="text-sm text-ink-soft">Choose Own on a vehicle to save a plan.</p>}</div></details>
  </div>;
}

function ApplicationSummary({ app, profile }: { app: Application; profile?: FinancialProfile }) {
  const offers = useOffers(app.id);
  return <article className="card space-y-3 !p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-black">{app.model?.label ?? "Vehicle finance"}</h3><span className="chip bg-sky-light text-sky-dark">{STATE_LABEL[app.state] ?? app.state}</span></div><p className="text-sm text-ink-soft">{app.lender.name}{app.demo ? " · Demo lender data" : ""} · started {dateFmt(app.created_at)}</p>
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Quote", inr(app.quote)], ["Contribution", inr(app.contribution)], ["Loan requested", inr(app.amount)], ["Tenure", `${app.tenure} months`]].map(([label,value]) => <div key={label}><dt className="text-[10px] uppercase text-ink-mute">{label}</dt><dd className="text-sm font-bold">{value}</dd></div>)}</dl>
    <details className="rounded-lg border border-ink/10 px-2 py-1.5"><summary className="cursor-pointer text-xs font-bold">Declared finances & verification</summary><dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{[["Monthly income", profile?.declared_monthly_income != null ? inr(profile.declared_monthly_income) : "Not collected"], ["Existing EMIs", profile?.declared_existing_emis != null ? inr(profile.declared_existing_emis) : "Not collected"], ["Employment", profile?.employment?.replace(/_/g," ") ?? "Not collected"], ["Identity", profile?.identity_status ?? "Not loaded"], ["KYC", profile?.kyc_status ?? "Not loaded"]].map(([label,value]) => <div key={label}><dt className="text-[10px] uppercase text-ink-mute">{label}</dt><dd className="text-xs font-bold">{value}</dd></div>)}</dl></details>
    <Link to={`/finance/${app.id}`} className="btn-go !min-h-[40px] text-sm">Resume / view application</Link>
    {offers.error ? <ErrorBox error={offers.error} retry={() => offers.refetch()} /> : offers.isLoading ? <Spinner label="Loading lender offers" /> : offers.data?.items.length ? <div className="space-y-3">{offers.data.items.map(o => <div key={o.id} className="rounded-2xl border border-go/30 p-4"><p className="font-black">{inr(o.emi)}/month · {o.tenure} months{o.id === app.accepted_offer_id ? " · Accepted" : ""}</p><p className="text-sm text-ink-soft">APR {o.apr}% · rate {o.rate}% · fees {inr(o.fees)} · total repayment {inr(o.total)}</p><p className="text-xs text-ink-mute">{app.demo ? "Demo offer" : "Lender offer"} · valid until {dateFmt(o.expires_at)}{o.conditional ? " · Conditional" : ""}</p>{o.conditions.map(c => <p key={c} className="text-xs text-sun-dark">{c}</p>)}<Link to={`/finance/${app.id}/offers/${o.id}`} className="btn-quiet mt-2 underline">Read Key Facts Statement</Link></div>)}</div> : <p className="text-sm text-ink-soft">No lender offers returned for this application yet.</p>}
  </article>;
}
