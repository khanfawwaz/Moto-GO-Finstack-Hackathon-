import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Doc } from "@/api/types";
import { cx, ErrorBox, PageHeader, Spinner, StatusChip } from "@/components/ui";
import { STATE_LABEL } from "../finance/Frame";

interface Row { id: string; state: string; current_step: string; user_id: string; updated_at: string }
interface Detail {
  application: { id: string; state: string; amount: number; model: { label: string } | null };
  steps: { step: string; status: string; values: Record<string, unknown> }[];
  timeline: { at: string; type: string; summary: string; state: string | null; provider: string | null; payload_hash: string | null }[];
  documents: Doc[];
  consents: { type: string; recipient: string; text_version: string; granted_at: string; withdrawn_at: string | null }[];
}

/** Read-only: one view of an application's state, consents and documents (metadata only). Audit-logged server-side. */
export default function Ops() {
  const [sel, setSel] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["ops"], queryFn: () => api<{ items: Row[] }>("/ops/applications") });
  const detail = useQuery({ queryKey: ["ops", sel], enabled: !!sel, queryFn: () => api<Detail>(`/ops/applications/${sel}`) });
  if (list.isLoading) return <Spinner />;
  if (list.error) return <ErrorBox error={list.error} />;
  return (
    <>
      <PageHeader title="Ops console" sub="Read-only. Every view is audit-logged. Identity numbers stay masked and documents show metadata only." />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <ul className="card max-h-[70dvh] space-y-1.5 overflow-y-auto !p-3" aria-label="Applications">
          {list.data?.items.map((r) => (
            <li key={r.id}><button onClick={() => setSel(r.id)} className={cx("min-h-[44px] w-full rounded-xl border-2 px-3 py-2 text-left", sel === r.id ? "border-go bg-go-light/40" : "border-transparent hover:bg-ink/5")}>
              <span className="block font-mono text-xs font-bold">{r.id.slice(0, 10)}</span><span className="text-sm font-extrabold">{STATE_LABEL[r.state] ?? r.state}</span></button></li>))}
          {!list.data?.items.length && <li className="p-3 font-semibold text-ink-soft">No applications.</li>}
        </ul>
        <div className="space-y-5">
          {!sel ? <p className="font-semibold text-ink-soft">Select an application.</p> : detail.isLoading ? <Spinner /> : detail.error ? <ErrorBox error={detail.error} /> : detail.data && (
            <>
              <section className="card"><h2 className="text-lg">{detail.data.application.model?.label} · {STATE_LABEL[detail.data.application.state]}</h2></section>
              <section className="card"><h2 className="mb-2 text-lg">Timeline</h2>
                <ol className="space-y-1.5 text-sm">{detail.data.timeline.map((e, i) => <li key={i} className="flex gap-3"><span className="w-20 shrink-0 font-mono text-xs text-ink-mute">{new Date(e.at + "Z").toLocaleTimeString("en-IN")}</span><span className="font-bold">{e.summary}</span>{e.payload_hash && <span className="font-mono text-[10px] text-ink-mute">#{e.payload_hash.slice(0, 8)}</span>}</li>)}</ol></section>
              <section className="card"><h2 className="mb-2 text-lg">Consent log</h2>
                <ul className="space-y-1 text-sm font-bold">{detail.data.consents.map((c, i) => <li key={i}>{c.type} → {c.recipient} · {c.text_version} · {new Date(c.granted_at + "Z").toLocaleString("en-IN")}{c.withdrawn_at && <span className="text-coral-dark"> · withdrawn</span>}</li>)}</ul></section>
              <section className="card"><h2 className="mb-2 text-lg">Documents (metadata)</h2>
                <ul className="space-y-1.5 text-sm font-bold">{detail.data.documents.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-2">{d.kind} · {d.filename}<StatusChip status={d.status} />{d.reason && <span className="font-semibold text-ink-mute">{d.reason}</span>}</li>)}</ul></section>
              <section className="card"><h2 className="mb-2 text-lg">Steps</h2>
                <ul className="space-y-1 text-sm font-bold">{detail.data.steps.map((s) => <li key={s.step}>{s.step}: {s.status}</li>)}</ul></section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
