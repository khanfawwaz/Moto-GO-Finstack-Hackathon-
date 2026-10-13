import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, HeartPulse, Info, Trophy, Truck } from "lucide-react";
import type { Vehicle } from "@/api/types";
import { asOf, inr, inrRange } from "@/lib/format";
import { VehicleImage } from "@/components/VehicleImage";
import { cx } from "@/components/ui";

const CONF: Record<string, string> = { high: "bg-go-light text-go-dark", medium: "bg-sun-light text-sun-dark", low: "bg-coral-light text-coral-dark" };

/** Value is primary. Equity is only relevant when there is an outstanding loan. */
export function EquityBlock({ v, big }: { v: Vehicle; big?: boolean }) {
  const { valuation: val, loan, equity } = v;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-mint/65 p-4">
        <p className="text-xs font-extrabold uppercase text-go-dark">Estimated value</p>
        <p className={cx("font-black text-ink", big ? "text-3xl" : "text-2xl")}>{val ? inrRange(val.low, val.high) : "Not valued"}</p>
        {val && <p className="mt-1 text-xs font-bold text-ink-soft">Maximum estimate {inr(val.high)} · {val.source}, {asOf(val.as_of)}</p>}
      </div>
      {loan.status === "active" && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border-2 border-ink/10 px-3 py-2 text-sm">
          <span className="font-extrabold text-ink-soft">Loan outstanding</span>
          <span className="font-black text-ink">{inr(loan.principal)}</span>
          {loan.statement_date && <span className="text-xs font-bold text-ink-mute">{asOf(loan.statement_date)}</span>}
        </div>
      )}
      {loan.status === "active" && equity.known ? (
        <div className={cx("rounded-2xl p-3.5", equity.negative ? "bg-coral-light/60" : "bg-go-light/60")}>
          <p className={cx("text-xs font-extrabold uppercase", equity.negative ? "text-coral-dark" : "text-go-dark")}>Estimated equity</p>
          <p className={cx("font-black", big ? "text-3xl" : "text-2xl", equity.negative ? "text-coral-dark" : "text-go-dark")}>{inrRange(equity.low, equity.high)}</p>
          {equity.negative && <p className="text-sm font-bold text-coral-dark">You may owe more than it's worth. Treat the gap as extra funding needed if you sell.</p>}
          <p className="mt-1 text-xs font-bold text-ink-soft">
            Loan {loan.source === "statement_parsed" ? "read from your statement" : "entered by you"}{" "}
            <span className={cx("chip ml-1 !py-0.5", CONF[equity.confidence ?? "low"])}>{equity.confidence} confidence</span>
          </p>
        </div>
      ) : loan.status === "unknown" ? (
        <div className="flex gap-3 rounded-2xl border-2 border-dashed border-ink/20 bg-white p-3.5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-dark" aria-hidden />
          <div className="text-sm font-bold text-ink-soft">
            <p className="font-extrabold text-ink">Loan balance not provided</p>
            We won't estimate equity until you add an outstanding balance.
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function VehicleCard({ v }: { v: Vehicle }) {
  const maximumValue = v.valuation?.high ?? v.model?.price_high ?? null;
  const points = maximumValue == null ? null : Math.max(1, Math.floor(maximumValue / 1000));
  return (
    <Link to={`/garage/${v.id}`} className="card block transition hover:border-go/60">
      <div className="flex items-center gap-3">
        <VehicleImage id={v.model?.id} label={v.label} type={v.type} className="h-16 w-24 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black">{v.label}</p>
          <p className="text-sm font-bold text-ink-mute">{v.year} · {v.type}{v.city ? ` · ${v.city}` : ""}{!v.verified_model && " · unverified model"}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-ink-mute" aria-hidden />
      </div>
      {v.delivery_status === "pending" && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-sky-light px-3 py-2 text-sm font-extrabold text-sky-dark"><Truck className="h-4 w-4" aria-hidden /> Delivery pending: financed vehicle, not yet with you</p>
      )}
      {v.ownership === "current" && <div className="mt-4"><EquityBlock v={v} big /></div>}
      {v.ownership === "current" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-sun-light/60 p-3">
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase text-sun-dark"><Trophy className="h-4 w-4" aria-hidden /> Value points</p>
            <p className="mt-1 text-2xl font-black text-ink">{points ?? "—"}</p>
            <p className="text-xs font-bold text-ink-soft">1 point per ₹1,000 of the maximum estimated value</p>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-ink/15 p-3">
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase text-ink-soft"><HeartPulse className="h-4 w-4" aria-hidden /> Vehicle health</p>
            <p className="mt-1 text-2xl font-black text-ink">—</p>
            <p className="text-xs font-bold text-ink-soft">Photo-based assessment coming soon</p>
          </div>
        </div>
      )}
      {v.next_care && (
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-ink-soft"><AlertTriangle className="h-4 w-4 text-sun-dark" aria-hidden /> {v.next_care.kind} due {new Date(v.next_care.due).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
      )}
    </Link>
  );
}
