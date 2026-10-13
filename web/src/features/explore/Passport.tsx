import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, BookmarkCheck, Flag, Route as RouteIcon } from "lucide-react";
import { api, ApiError } from "@/api/client";
import { useInvalidate, useMe, usePassport } from "@/api/hooks";
import { Callout, ErrorBox, PageHeader, Sheet, Spinner, useToast } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { asOf, inr, SEGMENT_LABEL, shortInr } from "@/lib/format";
import { BadgeChips, specLine } from "./parts";

const ACTIVITY = [
  ["spotted", "Spotted one on the road"], ["ridden", "Rode one"], ["driven", "Drove one"], ["test_driven", "Test-drove one"],
  ["rented", "Rented one"], ["past_owned", "Owned one before"],
] as const;

export default function Passport() {
  const { modelId = "" } = useParams();
  const { data, isLoading, error, refetch } = usePassport(modelId);
  const { data: me } = useMe();
  const nav = useNavigate();
  const toast = useToast();
  const inv = useInvalidate();
  const [logOpen, setLogOpen] = useState(false);
  const refresh = () => inv("passport", "collection", "me", "garage", "dream");

  const save = useMutation({
    mutationFn: (on: boolean) => on ? api("/activities", { body: { model_id: modelId, activity: "saved" } }) : api(`/activities/saved/${modelId}`, { method: "DELETE" }),
    onSuccess: (_, on) => { refresh(); toast(on ? "Saved to your Dream Garage" : "Removed from Dream Garage"); },
  });
  const needAccount = () => nav("/signup", { state: { next: `/explore/${modelId}`, reason: "Create a free profile to save and log models." } });

  const plan = useMutation({
    mutationFn: () => api<{ id: string }>("/goals", { body: { target_model_id: modelId } }),
    onSuccess: (g) => { inv("goals", "garage"); nav(`/ownership/${g.id}`); },
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} retry={() => refetch()} />;
  const { model: m, badges, fit, ownership_cost: oc } = data;
  const saved = badges.includes("saved");

  return (
    <>
      <PageHeader back={<Link to="/explore" className="mb-2 inline-flex items-center gap-1 text-sm font-extrabold text-ink-soft"><ArrowLeft className="h-4 w-4" /> Explore</Link>}
        title={m.label} sub={`${m.variant} · ${SEGMENT_LABEL[m.segment]} · ${m.type}`} />
      <div className="grid gap-5 md:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card flex items-center gap-5 map-bg">
            <VehicleImage id={m.id} label={m.label} type={m.type} className="h-28 w-40 rounded-2xl object-cover" priority />
            <div>
              <p className="text-2xl font-black">{shortInr(m.price_low)} – {shortInr(m.price_high)}</p>
              <p className="text-sm font-bold text-ink-soft">Ex-showroom range · {m.source} · {asOf(m.as_of)}</p>
              <p className="mt-1 font-bold">{specLine(m.specs)}</p>
            </div>
          </section>
          <section className="card"><h2 className="mb-2 text-lg">Your badges</h2><BadgeChips badges={badges} />
            <p className="help">Self-reported badges are marked as such. Saving earns no XP, and repeat logs don't earn extra.</p></section>
          <section className="card"><h2 className="mb-1 text-lg">Why it might fit</h2><p className="font-semibold text-ink-soft">{fit.reason}</p></section>
          <section className="card">
            <h2 className="mb-2 text-lg">What it costs to run (illustrative)</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div><dt className="text-xs font-extrabold uppercase text-ink-mute">Fuel / charge a year</dt><dd className="text-lg font-black">{oc.yearly_running != null ? inr(oc.yearly_running) : "Unavailable"}</dd></div>
              <div><dt className="text-xs font-extrabold uppercase text-ink-mute">Insurance a year</dt><dd className="text-lg font-black">{inr(oc.yearly_insurance)}</dd></div>
            </dl>
            <ul className="mt-3 list-disc pl-5 text-sm font-semibold text-ink-soft">{oc.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </section>
        </div>
        <aside className="space-y-3">
          <button className="btn-go w-full" onClick={() => (me ? setLogOpen(true) : needAccount())}><Flag className="h-5 w-5" aria-hidden /> Log an experience</button>
          <button className="btn-ghost w-full" disabled={save.isPending} onClick={() => (me ? save.mutate(!saved) : needAccount())}>
            {saved ? <BookmarkCheck className="h-5 w-5 text-go-dark" aria-hidden /> : <Bookmark className="h-5 w-5" aria-hidden />}{saved ? "In your Dream Garage" : "Save to Dream Garage"}</button>
          <Link to={`/experiences?model=${m.id}`} className="btn-ghost w-full">Try it (test ride or rental)</Link>
          <button className="btn-ghost w-full" disabled={plan.isPending} onClick={() => (me ? plan.mutate() : needAccount())}><RouteIcon className="h-5 w-5" aria-hidden /> Plan a Road-to</button>
          <Callout>{data.credit_note} Nothing on this page is sponsored.</Callout>
        </aside>
      </div>
      <LogSheet open={logOpen} onOpenChange={setLogOpen} modelId={modelId} label={m.label} onDone={refresh} />
    </>
  );
}

function LogSheet({ open, onOpenChange, modelId, label, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; modelId: string; label: string; onDone: () => void }) {
  const toast = useToast();
  const [activity, setActivity] = useState("spotted");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState("");
  const log = useMutation({
    mutationFn: () => api<{ duplicate: boolean; xp_awarded: number }>("/activities", { body: { model_id: modelId, activity, occurred_on: date || null, notes: notes || null, rating: rating ? Number(rating) : null } }),
    onSuccess: (r) => { onDone(); onOpenChange(false); toast(r.duplicate ? "Already logged. Repeat logs don't earn XP." : r.xp_awarded ? `Logged! +${r.xp_awarded} XP` : "Logged"); },
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Log: ${label}`} description="Self-reported unless a partner confirms it later.">
      <div className="space-y-4">
        <div><label className="label" htmlFor="act">What happened?</label>
          <select id="act" className="input" value={activity} onChange={(e) => setActivity(e.target.value)}>{ACTIVITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label" htmlFor="adate">Approximate date</label><input id="adate" type="date" className="input" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div><label className="label" htmlFor="anotes">Notes (optional)</label><input id="anotes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></div>
          <div><label className="label" htmlFor="arate">Rating</label><select id="arate" className="input" value={rating} onChange={(e) => setRating(e.target.value)}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></div>
        </div>
        {log.error instanceof ApiError && <p className="err" role="alert">{log.error.message}</p>}
        <p className="help">Rewards: spotted +50, driven/ridden or test drive +250, rental +500, each once per model and activity. Ownership in Garage earns 2,000 plus a value bonus. Borrowing earns no points.</p>
        <button className="btn-go w-full" disabled={log.isPending} onClick={() => log.mutate()}>{log.isPending ? "Saving…" : "Save to passport"}</button>
      </div>
    </Sheet>
  );
}
