import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Camera, CheckCircle2, Flag, Search } from "lucide-react";
import { useCollection } from "@/api/hooks";
import { Callout, cx, ErrorBox, PageHeader, Spinner, useDebounced } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { CaptureControl } from "./CaptureControl";
import { hasSeen, vehicleGroup } from "./vehicleGroups";
import { shortInr } from "@/lib/format";
import { VehicleJourney, type JourneyRoute } from "../roadmap/VehicleJourney";
import { JourneyProgress, journeyStages } from "./JourneyProgress";
import { useExploreFinancing } from "../roadmap/useExploreFinancing";
import { EligibilitySection, ExternalOnboardingStatus } from "../finance/ExternalOnboarding";

const TYPES = [["bike", "Bikes"], ["car", "Cars"], ["scooter", "Scooters"]] as const;

export default function Explore() {
  const { data, isLoading, error, refetch } = useCollection();
  const financing = useExploreFinancing();
  const [sp, setSp] = useSearchParams();
  const location = useLocation();
  const eligibilityId = sp.get("eligibility");
  useEffect(() => {
    if (eligibilityId && data) document.getElementById("eligibility")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [eligibilityId, !!data, location.key]);
  const planParams = new URLSearchParams();
  for (const key of ["goal", "rate", "tenure"]) { const value = sp.get(key); if (value) planParams.set(key, value); }
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [selectingCapture, setSelectingCapture] = useState(false);
  const captureVehicle = data?.models.find(m => m.id === captureId);
  const pickCapture = (id: string) => { setCaptureId(id); setSelectingCapture(false); document.getElementById("capture")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [initialRoute, setInitialRoute] = useState<JourneyRoute | null>(null);
  const dq = useDebounced(q).toLowerCase();
  const filtered = useMemo(() => (data?.models ?? []).filter(m =>
    (!type || m.type === type) && (!dq || m.label.toLowerCase().includes(dq)) &&
    (!status || (status === "saved" ? m.badges.includes("saved") : status === "progress" ? journeyStages(m.badges).some(s => s.done) : !journeyStages(m.badges).some(s => s.done)))
  ), [data, type, dq, status]);
  const open = (id: string, route: JourneyRoute | null = null) => { if (selectingCapture) { pickCapture(id); return; } setInitialRoute(route); setSp({ model: id }); };
  if (isLoading) return <Spinner label="Opening Explore" />;
  if (error || !data) return <ErrorBox error={error} retry={() => refetch()} />;
  return <>
    <PageHeader title="Explore" sub="Find your next machine. Test drive, rent or own—your progress lives here."
      action={<Link to="/garage#dream-garage" className="btn-ghost">Dream Garage</Link>} />
    {data.guest && <div className="mb-4"><Callout title="Make your progress yours"><Link to="/signup" state={{ next: "/explore" }} className="underline">Create a profile</Link> to save vehicles and completed experiences.</Callout></div>}
    <CaptureControl model={captureVehicle} selecting={selectingCapture} onSelect={() => setSelectingCapture(v => !v)} />
    <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden /><input className="input pl-10" aria-label="Search vehicles" placeholder="Search model or make" value={q} onChange={e => setQ(e.target.value)} /></div>
      <select className="input" aria-label="Vehicle type" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <select className="input" aria-label="Progress filter" value={status} onChange={e => setStatus(e.target.value)}><option value="">All progress</option><option value="progress">Started</option><option value="new">Not started</option><option value="saved">Dream Garage</option></select>
    </div>
    <EligibilitySection model={data.models.find(m => m.id === eligibilityId)} planParams={planParams.toString()} />
    <ExternalOnboardingStatus className="mb-5" />
    {financing.error && <ErrorBox error={financing.error} />}
    <div className="space-y-8">{TYPES.map(([id, label]) => {
      const models = filtered.filter(m => m.type === id);
      if (!models.length) return null;
      return <section key={id} aria-labelledby={`type-${id}`}>
        <h2 id={`type-${id}`} className="mb-3 text-xl">{label} <span className="text-sm text-ink-mute">({models.length})</span></h2>
        {[...new Set(models.map(vehicleGroup))].map(group => <div key={group} className="mb-6">
        <h3 className="mb-3 text-base text-ink-soft">{group}</h3>
        <ul className="grid gap-4 sm:grid-cols-2">{models.filter(m => vehicleGroup(m) === group).map(m => {
          const progress = journeyStages(m.badges).filter(s => s.done).length;
          const seen = hasSeen(m.badges);
          return <li key={m.id} className={cx("rounded-3xl p-[3px]", progress === 3 ? "bg-gradient-to-r from-sun via-go to-sun" : m.badges.includes("test_driven") ? "bg-gradient-to-r from-sun via-coral to-sun" : seen ? "bg-gradient-to-r from-sky via-go to-sky" : "bg-transparent")}>
            <article className="card flex h-full flex-col gap-3 !p-4">
              <button className="relative text-left" onClick={() => open(m.id)} aria-label={`Explore ${m.label}`}>
                <span className="mb-3 block overflow-hidden rounded-xl transition-[filter,opacity] duration-300" style={seen ? undefined : { filter: "grayscale(1) saturate(0) brightness(.75)", opacity: .72 }}><VehicleImage id={m.id} label={m.label} type={m.type} className="h-40 w-full object-cover" /></span>
                {!seen && <span className="absolute right-2 top-2 rounded-lg border-2 border-white/60 bg-ink/95 px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-white">Not seen</span>}
                {seen && <span className="absolute inset-x-2 top-2 flex flex-wrap gap-2">
                  {m.badges.includes("spotted") && <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-sky bg-ink/95 px-3 py-2 text-sm font-black text-sky-light"><CheckCircle2 className="h-5 w-5" aria-hidden /> SPOTTED</span>}
                  {m.badges.includes("test_driven") && <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-sun bg-ink/95 px-3 py-2 text-sm font-black text-sun-light"><Flag className="h-5 w-5" aria-hidden /> DRIVEN</span>}
                  {!m.badges.includes("spotted") && !m.badges.includes("test_driven") && <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-go bg-ink/95 px-3 py-2 text-sm font-black text-go-light"><CheckCircle2 className="h-5 w-5" aria-hidden /> {m.badges.includes("owned") ? "OWNED" : m.badges.some(b => ["rented", "short_rental", "long_rental"].includes(b)) ? "RENTED" : "SEEN"}</span>}
                </span>}
                <h3 className="text-xl font-black">{m.label}</h3><p className="text-sm text-ink-soft">{shortInr(m.price_low)} – {shortInr(m.price_high)}</p>
              </button>
              <JourneyProgress badges={m.badges} />
              <div className="mt-auto grid grid-cols-2 gap-2">
                <button className="btn-ghost !min-h-[42px] !px-1 text-sm" onClick={() => open(m.id, "test_drive")}>Test drive</button>
                <button className="btn-ghost !min-h-[42px] !px-1 text-sm" onClick={() => open(m.id, "short_rental")}>Rent</button>
                <button className="btn-go col-span-2 !min-h-[68px] flex-col !gap-0.5 !px-3" disabled={financing.isPending} aria-label={`Explore financing for ${m.label}. View your estimated monthly EMI.`} onClick={() => financing.mutate(m)}><span className="text-xl font-black">Own</span><span className="text-sm font-bold" title="*Open Explore financing to calculate an illustrative EMI. Actual lender terms may differ.">Est. EMI ₹XX,XXX per month*</span></button>
              </div>
              <button className="btn-quiet w-fit text-sm" onClick={() => pickCapture(m.id)}><Camera className="h-4 w-4" aria-hidden /> {m.badges.includes("spotted") ? "Capture again" : "Capture this vehicle · +50"}</button>
            </article>
          </li>;
        })}</ul></div>)}
      </section>;
    })}</div>
    {!filtered.length && <p role="status">No vehicles match your filters.</p>}
    <VehicleJourney key={`${sp.get("model")}:${initialRoute}`} modelId={sp.get("model")} initialRoute={initialRoute} onClose={() => { setSp({}); setInitialRoute(null); }} />
  </>;
}
