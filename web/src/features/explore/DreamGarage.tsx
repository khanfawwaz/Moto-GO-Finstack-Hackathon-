import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { useDream, useInvalidate } from "@/api/hooks";
import { EmptyState, ErrorBox, PageHeader, Spinner, useToast } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { shortInr } from "@/lib/format";

export default function DreamGarage() {
  const { data, isLoading, error, refetch } = useDream();
  const inv = useInvalidate();
  const toast = useToast();
  const remove = useMutation({ mutationFn: (id: string) => api(`/activities/saved/${id}`, { method: "DELETE" }), onSuccess: () => { inv("dream", "collection"); toast("Removed"); } });
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} retry={() => refetch()} />;
  const ids = data.items.map((m) => m.id).join(",");
  return (
    <>
      <PageHeader title="Dream Garage" sub="Saved models are a reversible interest signal: they never start a loan application or share anything with a lender." />
      {!data.items.length ? (
        <EmptyState title="Nothing saved yet" body="Save models from the collection to build a shortlist, with no pressure to buy."><Link to="/explore" className="btn-go">Explore the collection</Link></EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((m) => (
              <li key={m.id} className="card flex items-center gap-4">
                <VehicleImage id={m.id} label={m.label} type={m.type} className="h-16 w-24 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1"><Link to={`/explore/${m.id}`} className="block truncate text-lg font-black hover:underline">{m.label}</Link><p className="text-sm font-bold text-ink-mute">{shortInr(m.price_low)} – {shortInr(m.price_high)}</p></div>
                <Link to={`/experiences?model=${m.id}`} className="btn-ghost hidden sm:inline-flex">Try it</Link>
                <button className="btn-quiet !p-2" aria-label={`Remove ${m.label}`} onClick={() => remove.mutate(m.id)}><Trash2 className="h-5 w-5" /></button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            {data.items.length > 1 && <Link to={`/roadmap/compare?ids=${ids.split(",").slice(0, 3).join(",")}`} className="btn-go">Compare</Link>}
            <Link to="/roadmap" className="btn-ghost">Set a Road-to goal</Link>
          </div>
        </>
      )}
    </>
  );
}
