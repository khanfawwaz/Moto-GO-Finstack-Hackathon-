import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { GitCompare, Heart, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { useGarage, useGoals, useInvalidate, usePassport } from "@/api/hooks";
import { ModelPicker } from "@/components/ModelPicker";
import { EmptyState, ErrorBox, PageHeader, Sheet, Spinner, useToast } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { asOf, dateFmt, inr, shortInr } from "@/lib/format";
import { BadgeChips, specLine } from "../explore/parts";

export default function Roadmap() {
  const { data, isLoading, error, refetch } = useGoals();
  const { data: garage } = useGarage();
  const nav = useNavigate();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const inv = useInvalidate();
  const toast = useToast();
  const create = useMutation({
    mutationFn: (target_model_id: string) => api<{ id: string }>("/goals", { body: { target_model_id } }),
    onSuccess: (g) => { inv("goals", "garage"); nav(`/roadmap/goal/${g.id}`); },
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/goals/${id}`, { method: "DELETE" }), onSuccess: () => { inv("goals", "garage"); toast("Goal removed"); } });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} retry={() => refetch()} />;
  return (
    <>
      <PageHeader title="Roadmap" sub="You're so close to your dream vehicle. Explore how to arrive at it."
        action={<div className="flex flex-wrap gap-2"><Link to="/dream" className="btn-ghost"><Heart className="h-4 w-4" aria-hidden /> Dream Garage</Link><Link to="/roadmap/compare" className="btn-ghost"><GitCompare className="h-4 w-4" aria-hidden /> Compare</Link></div>} />
      <div className="grid gap-6 md:grid-cols-2">
        <section aria-label="Your goals" className="min-w-0 space-y-3">
          <h2 className="text-lg">Your goals</h2>
          {!data.items.length ? (
            <>
              <EmptyState title="No Road-to yet" body="Start with a vehicle that fits the kind of ride you have today. Choosing one fixes it as your Road-to vehicle."><span /></EmptyState>
              {!!garage?.suggestions.length && <div className="space-y-3">
                <h3 className="pt-1 text-base">Suggested next vehicles</h3>
                {garage.suggestions.map((m) => (
                  <div key={m.id} className="card flex items-center gap-3 !p-3">
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setPreviewId(m.id)} aria-label={`Open details for ${m.label}`}>
                      <VehicleImage id={m.id} label={m.label} type={m.type} priority className="h-16 w-24 shrink-0 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1"><p className="truncate font-black">{m.label}</p><p className="text-sm font-bold text-ink-soft">{inr(m.price_low)} – {inr(m.price_high)}</p><p className="mt-1 text-xs font-extrabold text-go-dark">View details</p></div>
                    </button>
                    <button className="btn-go !min-h-[42px] !px-3 text-sm" disabled={create.isPending} onClick={() => create.mutate(m.id)}>Choose</button>
                  </div>
                ))}
              </div>}
            </>
          ) : data.items.map((g) => (
            <div key={g.id} className="card flex items-center gap-4">
              {g.target_model && <VehicleImage id={g.target_model.id} label={g.target_model.label} type={g.target_model.type} className="h-14 w-20 rounded-2xl object-cover" />}
              <Link to={`/roadmap/goal/${g.id}`} className="min-w-0 flex-1">
                <p className="truncate text-lg font-black">Road to {g.target_model?.label}</p>
                <p className="text-sm font-bold text-ink-soft">Target {inr(g.price_assumption)}{g.target_date && ` · by ${dateFmt(g.target_date)}`}</p>
              </Link>
              <button className="btn-quiet !p-2" aria-label={`Delete goal ${g.target_model?.label}`} onClick={() => del.mutate(g.id)}><Trash2 className="h-5 w-5" /></button>
            </div>
          ))}
        </section>
        <section className="card min-w-0" aria-label="Start a goal">
          <h2 className="mb-1 text-lg">Start a Road-to</h2>
          <p className="mb-3 text-sm font-semibold text-ink-soft">Where do you want to go next?</p>
          <ModelPicker id="goal-model" onPick={(m) => setPreviewId(m.id)} compact noScroll />
        </section>
      </div>
      <RoadmapModelSheet modelId={previewId} onClose={() => setPreviewId(null)} onChoose={() => previewId && !create.isPending && create.mutate(previewId)} choosing={create.isPending} />
    </>
  );
}

function RoadmapModelSheet({ modelId, onClose, onChoose, choosing }: { modelId: string | null; onClose: () => void; onChoose: () => void; choosing: boolean }) {
  const { data, isLoading } = usePassport(modelId ?? "");
  return (
    <Sheet open={!!modelId} onOpenChange={(open) => !open && onClose()} title={data?.model.label ?? "Vehicle details"} description={data ? `${data.model.variant} · ${data.model.segment} · ${data.model.type}` : undefined}>
      {isLoading ? <Spinner label="Loading vehicle details" /> : data && <div className="space-y-4">
        <div className="flex items-center gap-4"><VehicleImage id={data.model.id} label={data.model.label} type={data.model.type} priority className="h-20 w-28 rounded-2xl object-cover" /><div><p className="text-lg font-black">{shortInr(data.model.price_low)} – {shortInr(data.model.price_high)}</p><p className="text-xs font-bold text-ink-mute">Ex-showroom · {data.model.source} · {asOf(data.model.as_of)}</p></div></div>
        <p className="font-semibold text-ink-soft">{specLine(data.model.specs)}</p>
        <BadgeChips badges={data.badges} />
        <section className="rounded-2xl bg-mint/55 p-3"><p className="text-xs font-extrabold uppercase text-go-dark">Why it might fit</p><p className="mt-1 text-sm font-semibold text-ink-soft">{data.fit.reason}</p></section>
        <section className="rounded-2xl border-2 border-ink/10 p-3"><p className="text-sm font-extrabold">Illustrative running cost</p><div className="mt-2 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs font-bold uppercase text-ink-mute">Fuel / charge yearly</p><p className="font-black">{data.ownership_cost.yearly_running != null ? inr(data.ownership_cost.yearly_running) : "Unavailable"}</p></div><div><p className="text-xs font-bold uppercase text-ink-mute">Insurance yearly</p><p className="font-black">{inr(data.ownership_cost.yearly_insurance)}</p></div></div></section>
        <button className="btn-go w-full" disabled={choosing} onClick={onChoose}>{choosing ? "Choosing…" : "Choose as my Road-to"}</button>
      </div>}
    </Sheet>
  );
}
