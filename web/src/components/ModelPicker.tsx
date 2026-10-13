import { useState } from "react";
import { Search } from "lucide-react";
import { useModels } from "@/api/hooks";
import type { Model, VType } from "@/api/types";
import { shortInr, SEGMENT_LABEL } from "@/lib/format";
import { VehicleImage } from "@/components/VehicleImage";
import { cx, useDebounced } from "./ui";

/** Search-first model picker. `types` limits the catalogue; the parent decides what manual entry means. */
export function ModelPicker({ id, value, onPick, type, types, placeholder = "Search make or model, e.g. Hunter", compact, noScroll = false }: {
  id: string; value?: string | null; onPick: (m: Model) => void; type?: VType; types?: VType[]; placeholder?: string; compact?: boolean; noScroll?: boolean;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const { data, isFetching } = useModels(dq, type);
  const items = (data?.items ?? []).filter((m) => !types || types.includes(m.type)).slice(0, compact ? 6 : 10);
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-mute" aria-hidden />
        <input id={id} className="input pl-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
          role="combobox" aria-expanded aria-controls={`${id}-list`} autoComplete="off" />
      </div>
      <ul id={`${id}-list`} role="listbox" aria-label="Matching models" aria-busy={isFetching} className={cx("mt-2 space-y-1.5", !noScroll && "max-h-72 overflow-y-auto pr-1")}>
        {items.map((m) => (
          <li key={m.id} role="option" aria-selected={value === m.id}>
            <button type="button" onClick={() => onPick(m)}
              className={cx("flex min-h-[44px] w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition",
                value === m.id ? "border-go bg-go-light/50" : "border-ink/10 bg-white hover:border-go/60")}>
              <VehicleImage id={m.id} label={m.label} type={m.type} className="h-11 w-16 rounded-xl object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold">{m.label}</span>
                <span className="block text-xs font-semibold text-ink-mute">{m.variant} · {SEGMENT_LABEL[m.segment]} · {m.type}</span>
              </span>
              <span className="text-xs font-extrabold text-ink-soft">{shortInr(m.price_low)}+</span>
            </button>
          </li>
        ))}
        {!items.length && !isFetching && <li className="p-3 text-sm font-semibold text-ink-mute">No match in the catalogue.</li>}
      </ul>
    </div>
  );
}
