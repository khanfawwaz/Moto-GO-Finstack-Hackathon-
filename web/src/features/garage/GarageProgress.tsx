import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useCollection } from "@/api/hooks";
import type { Model, Vehicle } from "@/api/types";
import { VehicleImage } from "@/components/VehicleImage";
import { JourneyProgress } from "../explore/JourneyProgress";
import { inrRange, shortInr } from "@/lib/format";

export function GarageProgress({ vehicles, dreams }: { vehicles: Vehicle[]; dreams: Model[] }) {
  const [vehicleId, setVehicleId] = useState("");
  const [dreamId, setDreamId] = useState("");
  const { data: collection } = useCollection();
  const current = vehicles.find(v => v.id === vehicleId) ?? vehicles[0];
  const dream = dreams.find(m => m.id === dreamId) ?? dreams[0];
  const badges = collection?.models.find(m => m.id === dream?.id)?.badges ?? [];
  return <section className="mb-6" aria-label="Your vehicle to dream vehicle progression">
    <div className="grid items-stretch gap-3 md:grid-cols-[1fr_100px_1fr]">
      <div className="card space-y-3">
        <p className="text-xs font-extrabold uppercase tracking-wide text-sun-dark">01 · Your vehicle today</p>
        {vehicles.length > 1 && <select className="input" aria-label="Current vehicle for progression" value={current?.id ?? ""} onChange={e => setVehicleId(e.target.value)}>{vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select>}
        {current ? <>
          <Link to={`/garage/${current.id}`}><VehicleImage id={current.model?.id} label={current.label} type={current.type} priority className="h-44 w-full rounded-xl object-cover" /><h2 className="mt-3 text-2xl font-black">{current.label}</h2></Link>
          <p className="text-sm text-ink-soft">Estimated value</p><p className="text-2xl font-black">{current.valuation ? inrRange(current.valuation.low, current.valuation.high) : "Add details for an estimate"}</p>
          {current.loan.status === "active" && <p className="text-sm text-go-dark">Upgrade equity: {current.equity.known ? inrRange(current.equity.low, current.equity.high) : "Confirm loan balance"}</p>}
        </> : <div className="flex min-h-56 flex-col justify-center gap-3"><p>Add your current vehicle to see its value alongside your dream.</p><Link className="btn-ghost" to="/garage/add">Add your vehicle</Link></div>}
      </div>
      <div className="flex items-center justify-center gap-3 py-2 md:flex-col" aria-label="Progress towards your dream vehicle">
        <span className="h-px flex-1 bg-go/40 md:h-12 md:w-px md:flex-none" aria-hidden />
        <ArrowRight className="hidden h-7 w-7 text-go-dark md:block" aria-hidden /><ArrowDown className="h-7 w-7 text-go-dark md:hidden" aria-hidden />
        <span className="text-center text-xs font-bold text-go-dark">Your next<br />chapter</span>
        <span className="h-px flex-1 bg-go/40 md:h-12 md:w-px md:flex-none" aria-hidden />
      </div>
      <div className="card space-y-3">
        <p className="text-xs font-extrabold uppercase tracking-wide text-go-dark">02 · Your dream vehicle</p>
        {dreams.length > 1 && <select className="input" aria-label="Dream vehicle for progression" value={dream?.id ?? ""} onChange={e => setDreamId(e.target.value)}>{dreams.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select>}
        {dream ? <>
          <Link to={`/explore?model=${dream.id}`}><VehicleImage id={dream.id} label={dream.label} type={dream.type} priority className="h-44 w-full rounded-xl object-cover" /><h2 className="mt-3 text-2xl font-black">{dream.label}</h2></Link>
          <p className="text-sm text-ink-soft">Catalogue estimate · {shortInr(dream.price_low)} – {shortInr(dream.price_high)}</p>
          <JourneyProgress badges={badges} />
          <Link to={`/explore?model=${dream.id}`} className="btn-go w-full">Take the next step</Link>
        </> : <div className="flex min-h-56 flex-col justify-center gap-3"><p>Choose a vehicle to connect today's garage to your next experience.</p><Link to="/explore" className="btn-go">Choose your dream vehicle</Link><p className="text-xs text-ink-mute">Save it to Dream Garage to see it here.</p></div>}
      </div>
    </div>
  </section>;
}
