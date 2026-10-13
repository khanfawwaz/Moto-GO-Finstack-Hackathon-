import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, X } from "lucide-react";
import { api } from "@/api/client";
import type { Model } from "@/api/types";
import { ModelPicker } from "@/components/ModelPicker";
import { VehicleImage } from "@/components/VehicleImage";
import { PageHeader } from "@/components/ui";
import { asOf, SEGMENT_LABEL, shortInr } from "@/lib/format";

export default function Compare() {
  const [sp, setSp] = useSearchParams();
  const ids = (sp.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3);
  const [adding, setAdding] = useState(ids.length < 2);
  const { data } = useQuery({
    queryKey: ["compare", ids.join(",")], enabled: ids.length > 0,
    queryFn: () => api<{ items: Model[] }>(`/catalogue/models?ids=${ids.join(",")}`),
  });
  const items = ids.map((id) => data?.items.find((m) => m.id === id)).filter(Boolean) as Model[];
  useEffect(() => { if (ids.length >= 3) setAdding(false); }, [ids.length]);
  const set = (next: string[]) => setSp(next.length ? { ids: next.join(",") } : {});

  const rows: [string, (m: Model) => React.ReactNode][] = [
    ["Type", (m) => m.type], ["Purpose", (m) => SEGMENT_LABEL[m.segment]],
    ["Ex-showroom range", (m) => `${shortInr(m.price_low)} – ${shortInr(m.price_high)}`],
    ["Engine / range", (m) => (m.specs.cc ? `${m.specs.cc} cc` : m.specs.range ?? "—")],
    ["Power (bhp)", (m) => m.specs.bhp ?? "—"], ["Efficiency", (m) => m.specs.eff ?? "—"],
    ["Price source", (m) => `${m.source}, ${asOf(m.as_of)}`],
  ];

  return (
    <>
      <PageHeader back={<Link to="/roadmap" className="mb-2 inline-flex items-center gap-1 text-sm font-extrabold text-ink-soft"><ArrowLeft className="h-4 w-4" /> Roadmap</Link>}
        title="Compare vehicles" sub="Side by side, on facts. Price isn't a score, and nothing is ranked for you." />
      {items.length > 0 && (
        <div className="card mb-5 overflow-x-auto !p-0">
          <table className="w-full min-w-[520px] text-left">
            <caption className="sr-only">Comparison of selected vehicles</caption>
            <thead><tr className="border-b-2 border-ink/10"><td className="p-3" />{items.map((m) => (
              <th key={m.id} scope="col" className="p-3 align-top">
                <div className="flex items-start justify-between gap-2"><VehicleImage id={m.id} label={m.label} type={m.type} className="mb-2 h-16 w-24 rounded-2xl object-cover" /><Link to={`/explore/${m.id}`} className="text-lg font-black hover:underline">{m.label}</Link>
                  <button aria-label={`Remove ${m.label}`} className="btn-quiet !min-h-[36px] !p-1.5" onClick={() => set(ids.filter((i) => i !== m.id))}><X className="h-4 w-4" /></button></div>
              </th>))}</tr></thead>
            <tbody>
              {rows.map(([label, fn]) => (
                <tr key={label} className="border-b border-ink/10 last:border-0">
                  <th scope="row" className="p-3 text-xs font-extrabold uppercase text-ink-mute">{label}</th>
                  {items.map((m) => <td key={m.id} className="p-3 font-bold capitalize">{fn(m)}</td>)}
                </tr>))}
            </tbody>
          </table>
        </div>
      )}
      {ids.length < 3 && (adding || !items.length ? (
        <section className="card"><h2 className="mb-2 text-lg">Add a vehicle ({ids.length}/3)</h2>
          <ModelPicker id="cmp" onPick={(m) => { if (!ids.includes(m.id)) set([...ids, m.id]); }} compact /></section>
      ) : <button className="btn-ghost" onClick={() => setAdding(true)}>Add another vehicle</button>)}
    </>
  );
}
