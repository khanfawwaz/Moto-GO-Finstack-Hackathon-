import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCollection, useDream, useGoals } from "@/api/hooks";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { shortInr } from "@/lib/format";
import { VehicleJourney } from "./VehicleJourney";

export default function RoadmapList() {
  const { data, isLoading, error } = useCollection();
  const { data: dreams } = useDream();
  const { data: goals } = useGoals();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState("");
  const saved = new Set([...(dreams?.items.map(m => m.id) ?? []), ...(goals?.items.flatMap(g => g.target_model ? [g.target_model.id] : []) ?? [])]);
  const models = [...(data?.models ?? [])].filter(m => m.label.toLowerCase().includes(q.toLowerCase())).sort((a,b) => Number(saved.has(b.id)) - Number(saved.has(a.id)));
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  return <>
    <PageHeader title="Roadmap" sub="Choose a vehicle. Build your progress through a test drive, a rental, or ownership—at your own pace." />
    <input className="input mb-4" aria-label="Search Roadmap vehicles" placeholder="Find your next vehicle" value={q} onChange={e => setQ(e.target.value)} />
    <ul className="space-y-3">{models.map(m => <li key={m.id}><button className="card flex w-full items-center gap-4 text-left" onClick={() => setSp({ model: m.id })}>
      <VehicleImage id={m.id} label={m.label} type={m.type} className="h-20 w-28 shrink-0 rounded-xl object-cover" />
      <span className="min-w-0"><span className="block font-black">{m.label}</span><span className="block text-sm text-ink-soft">{shortInr(m.price_low)} – {shortInr(m.price_high)}{saved.has(m.id) ? " · Your shortlist" : ""}</span><span className="mt-2 block text-xs font-bold text-go-dark">{m.badges.includes("test_driven") ? "Test drive ✓" : "Test drive"} → {m.badges.some(b => ["rented", "short_rental", "long_rental"].includes(b)) ? "Rent ✓" : "Rent"} → {m.badges.includes("owned") ? "Own ✓" : "Own"}</span>{m.badges.some(b => b.startsWith("intent_")) && <span className="block text-xs text-ink-soft">Interested in: {m.badges.filter(b => b.startsWith("intent_")).map(b => b.replace("intent_", "").replace(/_/g, " ")).join(" · ")}</span>}<span className="mt-1 block text-xs text-ink-mute">Explore your options →</span></span>
    </button></li>)}</ul>
    {!models.length && <p>No vehicles match your search.</p>}
    <VehicleJourney key={sp.get("model")} modelId={sp.get("model")} onClose={() => setSp({})} />
  </>;
}
