import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, Bell, ChevronLeft, ChevronRight, HeartPulse, Plus, Sparkles, Trophy } from "lucide-react";
import { useCollection, useDream, useGarage, useGoals } from "@/api/hooks";
import type { Vehicle } from "@/api/types";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { JourneyProgress } from "../explore/JourneyProgress";
import { dateFmt, inrRange, shortInr } from "@/lib/format";
import { EquityBlock } from "./parts";

export default function Garage() {
  const { data, isLoading, error, refetch } = useGarage();
  const dreams = useDream();
  const goals = useGoals();
  const collection = useCollection();
  if (isLoading) return <Spinner label="Opening your garage" />;
  if (error || !data) return <ErrorBox error={error} retry={() => refetch()} />;
  const current = data.vehicles.filter(v => v.ownership === "current");
  const dreamModels = [...new Map([...(dreams.data?.items ?? []), ...(goals.data?.items.flatMap(g => g.target_model ? [g.target_model] : []) ?? [])].map(m => [m.id, m])).values()];
  const dreamCards = dreamModels.length ? dreamModels : data.suggestions;
  return <>
    <PageHeader title="My Garage" sub="The machines you own. The ones you dream about."
      action={<Link to="/garage/add" className="btn-go"><Plus className="h-4 w-4" aria-hidden /> Add vehicle</Link>} />
    <section aria-labelledby="owned-vehicles" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="owned-vehicles" className="text-xl">Your vehicles <span className="text-sm text-ink-mute">({current.length})</span></h2>
        {data.total_equity && <div className="text-right"><p className="text-xs font-extrabold uppercase text-go-dark">Total estimated equity</p><p className="text-xl font-black">{inrRange(data.total_equity.low, data.total_equity.high)}</p>{data.total_equity.counted < data.total_equity.of && <p className="text-xs text-ink-mute">{data.total_equity.counted} of {data.total_equity.of} vehicles with known value and debt</p>}</div>}
      </div>
      {current.length ? <OwnedCarousel vehicles={current} /> : <div className="card space-y-3"><p>Your garage starts with the vehicle you own today.</p><Link to="/garage/add" className="btn-go">Add your vehicle · earn ownership points</Link></div>}
    </section>
    <div className="flex flex-col items-center gap-1 py-6 text-go-dark" aria-label="From your garage to your dream vehicles"><span className="h-6 w-px bg-go/40" aria-hidden /><ArrowDown className="h-6 w-6" aria-hidden /><span className="text-xs font-extrabold uppercase tracking-widest">Your next chapter</span></div>
    <section id="dream-garage" aria-labelledby="dream-heading" className="relative isolate overflow-hidden rounded-3xl border border-sky/30 bg-gradient-to-br from-sky-dark/20 via-ink to-go-dark/20 p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-20 -z-10 h-80 w-80 rounded-full bg-sky/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 -left-12 -z-10 h-64 w-64 rounded-full bg-go/20 blur-3xl" aria-hidden />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-sun-light"><Sparkles className="h-4 w-4" aria-hidden /> The dream collection</p><h2 id="dream-heading" className="mt-1 text-3xl">What comes next?</h2><p className="mt-1 text-sm text-white/70">A first drive. A weekend together. Someday, your own keys.</p></div><Link to="/explore" className="btn-ghost">Find your next dream</Link></div>
      {dreams.isLoading || goals.isLoading ? <Spinner /> : dreams.error || goals.error ? <ErrorBox error={dreams.error || goals.error} /> : !dreamCards.length ? <div className="rounded-2xl border border-dashed border-sky/30 p-8 text-center"><Sparkles className="mx-auto mb-3 h-8 w-8 text-sun-light" aria-hidden /><p className="text-lg font-black">Leave room for something extraordinary.</p><p className="mt-2 text-sm text-white/65">Save a vehicle in Explore to start your Dream Garage.</p><Link to="/explore" className="btn-go mt-4">Discover a dream vehicle</Link></div> :
        <div className="grid gap-5 sm:grid-cols-2">{dreamCards.map(m => <article key={m.id} className="overflow-hidden rounded-2xl border border-white/15 bg-ink/50">
          <Link to={`/explore?model=${m.id}`} className="relative block"><VehicleImage id={m.id} label={m.label} type={m.type} className="h-52 w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" aria-hidden /><span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-sun/40 bg-ink/85 px-3 py-1 text-xs font-extrabold text-sun-light"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Dream vehicle</span></Link>
          <div className="space-y-3 p-4"><h3 className="text-2xl font-black">{m.label}</h3><p className="text-sm text-ink-soft">{shortInr(m.price_low)} – {shortInr(m.price_high)}</p><JourneyProgress badges={collection.data?.models.find(v => v.id === m.id)?.badges ?? []} /><Link to={`/explore?model=${m.id}`} className="btn-go w-full">Take the next step</Link></div>
        </article>)}</div>}
      {!!dreamModels.length && !!data.suggestions.length && <div className="mt-6 border-t border-white/10 pt-4"><p className="mb-3 text-sm font-bold text-white/70">Dream suggestions</p><div className="grid gap-3 sm:grid-cols-2">{data.suggestions.slice(0,2).map(m => <Link key={m.id} to={`/explore?model=${m.id}`} className="flex items-center gap-3 rounded-xl border border-white/15 p-3"><VehicleImage id={m.id} label={m.label} type={m.type} className="h-16 w-24 shrink-0 rounded-lg object-cover" /><div><p className="text-[10px] font-bold uppercase tracking-widest text-sun-light">Dream {m.type}</p><p className="text-lg font-black">{m.label} →</p><p className="text-xs text-white/70">{shortInr(m.price_low)} – {shortInr(m.price_high)}</p></div></Link>)}</div></div>}
    </section>
  </>;
}

function OwnedCarousel({ vehicles }: { vehicles: Vehicle[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const move = (next: number) => {
    const el = track.current?.children[next] as HTMLElement | undefined;
    if (el && track.current) track.current.scrollTo({ left: el.offsetLeft - (track.current.children[0] as HTMLElement).offsetLeft, behavior: "smooth" });
  };
  return <div className="space-y-3">
    {vehicles.length > 1 && <div className="flex items-center justify-between"><p className="text-sm text-ink-soft">Swipe to switch vehicles · {index + 1}/{vehicles.length}</p><div className="flex gap-2"><button className="btn-ghost !min-h-[40px] !p-2" aria-label="Previous vehicle" disabled={index === 0} onClick={() => move(index-1)}><ChevronLeft className="h-5 w-5" /></button><button className="btn-ghost !min-h-[40px] !p-2" aria-label="Next vehicle" disabled={index === vehicles.length-1} onClick={() => move(index+1)}><ChevronRight className="h-5 w-5" /></button></div></div>}
    <div ref={track} className="relative grid snap-x snap-mandatory auto-cols-[100%] grid-flow-col gap-4 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onScroll={e => { const el = e.currentTarget; setIndex(Math.round(el.scrollLeft / (el.clientWidth + 16))); }}>
      {vehicles.map(v => { const points = v.valuation ? Math.max(1, Math.floor(v.valuation.high / 1000)) : v.model ? Math.floor(v.model.price_high/1000) : 0; return <article key={v.id} className="card min-w-0 snap-start space-y-4">
        <div className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3"><Link to={`/garage/${v.id}`}><VehicleImage id={v.model?.id} label={v.label} type={v.type} priority className="h-48 w-full rounded-2xl object-cover" /><h3 className="mt-3 text-2xl font-black">{v.label}</h3><p className="text-sm text-ink-mute">{v.year} · {v.city ?? "Your vehicle"}{v.delivery_status === "pending" ? " · Delivery pending" : ""}</p></Link>
            <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-sun-light/60 p-3"><p className="flex items-center gap-1 text-xs font-extrabold uppercase text-sun-dark"><Trophy className="h-4 w-4" aria-hidden /> Value points</p><p className="text-2xl font-black">{points.toLocaleString("en-IN")}</p><p className="text-xs text-ink-soft">Maximum estimate / ₹1,000</p></div><div className="rounded-xl border border-ink/15 p-3"><p className="flex items-center gap-1 text-xs font-extrabold uppercase text-ink-soft"><HeartPulse className="h-4 w-4" aria-hidden /> Health</p><p className="text-2xl font-black">—</p><p className="text-xs text-ink-mute">Assessment not available</p></div></div>
          </div>
          <div className="space-y-3"><EquityBlock v={v} big /><div className="rounded-xl border border-sun/30 p-3"><p className="text-sm font-black text-sun-dark">Ownership reward: {(2000+10*points).toLocaleString("en-IN")} points</p><p className="text-xs text-ink-soft">2,000 base + 10 × value points · once per model</p></div></div>
        </div>
        <div className="grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-2">{["Service", "Insurance"].map(kind => { const due = v.reminders?.find(r => kind === "Insurance" ? r.kind === "Insurance renewal" : r.kind !== "Insurance renewal"); return <Link key={kind} to={`/garage/${v.id}?tab=care`} className="rounded-xl bg-mint/55 p-3"><p className="flex items-center gap-2 text-sm font-extrabold"><Bell className="h-4 w-4 text-sun-dark" aria-hidden /> {kind} reminder</p><p className="mt-1 text-sm text-ink-soft">{due ? `${due.kind} · ${dateFmt(due.due)}` : "Set a reminder →"}</p></Link>; })}</div>
      </article>; })}
    </div>
    {vehicles.length > 1 && <div className="flex justify-center gap-2">{vehicles.map((v,i) => <button key={v.id} aria-label={`Show ${v.label}`} aria-pressed={i===index} onClick={() => move(i)} className={`h-2 rounded-full transition-all ${i===index ? "w-6 bg-go" : "w-2 bg-ink/20"}`} />)}</div>}
  </div>;
}
