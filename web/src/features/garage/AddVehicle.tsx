import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/api/client";
import { useInvalidate } from "@/api/hooks";
import type { Model, Vehicle, VType } from "@/api/types";
import { ModelPicker } from "@/components/ModelPicker";
import { UploadField } from "@/components/UploadField";
import { Callout, cx, PageHeader, useToast } from "@/components/ui";

const THIS_YEAR = new Date().getFullYear();
const TYPES: [VType, string][] = [["scooter", "Scooter"], ["bike", "Bike"], ["car", "Car"]];

export default function AddVehicle() {
  const nav = useNavigate();
  const location = useLocation();
  const prefilled = (location.state as { model?: Model } | null)?.model;
  const toast = useToast();
  const inv = useInvalidate();
  const [type, setType] = useState<VType>(() => prefilled?.type ?? "scooter");
  const [model, setModel] = useState<Model | null>(() => prefilled ?? null);
  const [manual, setManual] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [variant, setVariant] = useState("");
  const [year, setYear] = useState("");
  const [ownership, setOwnership] = useState<"current" | "past">("current");
  const [city, setCity] = useState("");
  const [odo, setOdo] = useState("");
  const [cond, setCond] = useState("");
  const [owners, setOwners] = useState("");
  const [accident, setAccident] = useState("");
  const [modified, setModified] = useState("");
  const [rc, setRc] = useState<string | undefined>();
  const [errs, setErrs] = useState<Record<string, string>>({});

  const add = useMutation({
    mutationFn: (body: unknown) => api<Vehicle>("/vehicles", { body }),
    onSuccess: (v) => { inv("garage", "vehicles", "collection", "me"); toast("Added to your garage · ownership points earned"); nav(`/garage/${v.id}`); },
    onError: (e) => { if (e instanceof ApiError && e.field) setErrs({ [e.field]: e.message }); else setErrs({ form: (e as Error).message }); },
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!manual && !model) e.model_id = "Pick your model from the list, or enter it manually.";
    if (manual && !freeText.trim()) e.free_text_model = "Type the make and model.";
    const y = Number(year);
    if (!year || !Number.isInteger(y) || y < 1950 || y > THIS_YEAR) e.year = `Enter a year between 1950 and ${THIS_YEAR}.`;
    setErrs(e);
    if (Object.keys(e).length) return;
    const num = (s: string) => (s === "" ? null : Number(s));
    add.mutate({
      type, model_id: manual ? null : model?.id, free_text_model: manual ? freeText : null, variant: variant || null, year: y, ownership,
      city: city || null, odometer: num(odo), condition: cond || null, owners: num(owners),
      accident_flag: accident === "" ? null : accident === "yes", modified_flag: modified === "" ? null : modified === "yes", rc_document_id: rc ?? null,
    });
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Add a vehicle" sub="Search the catalogue first. Manual entry is always available." />

      <fieldset>
        <legend className="label">Vehicle type</legend>
        <div className="flex gap-2.5">
          {TYPES.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={type === v} onClick={() => { setType(v); setModel(null); }}
              className={cx("min-h-[44px] flex-1 rounded-2xl border-2 font-extrabold", type === v ? "border-go bg-go text-white shadow-chunk-go" : "border-ink/15 bg-white")}>{l}</button>
          ))}
        </div>
      </fieldset>

      <div>
        <span className="label">Make and model</span>
        {!manual ? (
          <>
            <ModelPicker id="model" type={type} value={model?.id} onPick={setModel} />
            {model && <p className="help">Selected: <b>{model.label}</b> ({model.variant})</p>}
            {errs.model_id && <p className="err" role="alert">{errs.model_id}</p>}
            <button type="button" className="btn-quiet mt-1 underline" onClick={() => setManual(true)}>I can't find it, enter it manually</button>
          </>
        ) : (
          <>
            <input className="input" aria-label="Make and model" value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="e.g. Rajdoot 175" maxLength={120} />
            {errs.free_text_model && <p className="err" role="alert">{errs.free_text_model}</p>}
            <p className="help">Marked unverified, and we can't estimate a value for models outside the catalogue.</p>
            <button type="button" className="btn-quiet mt-1 underline" onClick={() => setManual(false)}>Search the catalogue instead</button>
          </>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="variant">Variant <span className="font-semibold text-ink-mute">(optional)</span></label>
          <input id="variant" className="input" value={variant} onChange={(e) => setVariant(e.target.value)} maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="year">Year</label>
          <input id="year" className={cx("input", errs.year && "input-err")} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={String(THIS_YEAR - 3)} />
          {errs.year && <p className="err" role="alert">{errs.year}</p>}
        </div>
      </div>

      <fieldset>
        <legend className="label">Do you own it now?</legend>
        <div className="flex gap-2.5">
          {([["current", "Own it now"], ["past", "Owned it before"]] as const).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={ownership === v} onClick={() => setOwnership(v)}
              className={cx("min-h-[44px] flex-1 rounded-2xl border-2 font-extrabold", ownership === v ? "border-go bg-go text-white shadow-chunk-go" : "border-ink/15 bg-white")}>{l}</button>
          ))}
        </div>
        <p className="help">Past ownership is self-reported until verified.</p>
      </fieldset>

      {ownership === "current" && (
        <section className="card space-y-5">
          <div>
            <h2 className="text-lg">For a value estimate</h2>
            <p className="text-sm font-semibold text-ink-soft">All optional. The more you add, the narrower and more confident the range.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="label" htmlFor="city">City</label><input id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} /></div>
            <div><label className="label" htmlFor="odo">Odometer (km)</label><input id="odo" className="input" inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value.replace(/\D/g, ""))} /></div>
            <div><label className="label" htmlFor="cond">Condition</label>
              <select id="cond" className="input" value={cond} onChange={(e) => setCond(e.target.value)}>
                <option value="">Not sure</option>{["excellent", "good", "fair", "poor"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
              </select></div>
            <div><label className="label" htmlFor="owners">Number of owners</label><input id="owners" className="input" inputMode="numeric" value={owners} onChange={(e) => setOwners(e.target.value.replace(/\D/g, "").slice(0, 2))} /></div>
            <YesNo id="acc" label="Any accident history?" value={accident} onChange={setAccident} />
            <YesNo id="mod" label="Any modifications?" value={modified} onChange={setModified} />
          </div>
          <div>
            <UploadField id="rc" kind="rc" label="Registration certificate (optional)" onChange={(id) => setRc(id)} hint="PDF, JPG or PNG · up to 10 MB" />
            <p className="help">Used only to help confirm ownership later. We never verify ownership from a photo alone.</p>
          </div>
        </section>
      )}

      {errs.form && <Callout tone="warn">{errs.form}</Callout>}
      <div className="flex gap-3">
        <button className="btn-go" disabled={add.isPending}>{add.isPending ? "Saving…" : "Save to my garage"}</button>
        <Link to="/garage" className="btn-quiet">Cancel</Link>
      </div>
    </form>
  );
}

function YesNo({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div><label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}><option value="">Not sure</option><option value="no">No</option><option value="yes">Yes</option></select></div>
  );
}
