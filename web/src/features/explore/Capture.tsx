import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Camera, EyeOff, ShieldCheck } from "lucide-react";
import { api } from "@/api/client";
import { useInvalidate, useMe } from "@/api/hooks";
import type { Model } from "@/api/types";
import { ModelPicker } from "@/components/ModelPicker";
import { Callout, PageHeader } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { Link } from "react-router-dom";

/** P0: manual model pick only. The photo is previewed on-device and never uploaded in this build. */
export default function Capture() {
  const { data: me } = useMe();
  const nav = useNavigate();
  const inv = useInvalidate();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [result, setResult] = useState<{ duplicate: boolean; xp_awarded: number } | null>(null);

  useEffect(() => { if (!file) { setUrl(null); return; } const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);

  const add = useMutation({
    mutationFn: () => api<{ duplicate: boolean; xp_awarded: number }>("/activities", { body: { model_id: model!.id, activity: "spotted" } }),
    onSuccess: (r) => { setResult(r); inv("collection", "me", "garage"); },
  });
  const submit = () => (me ? add.mutate() : nav("/signup", { state: { next: "/capture", reason: "Create a free profile to add discoveries." } }));

  if (result && model) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="card animate-pop space-y-3 !p-8">
          <VehicleImage id={model.id} label={model.label} type={model.type} className="h-28 w-40 rounded-2xl object-cover" />
          <h1 className="text-2xl">{result.duplicate ? "Already in your collection" : "Discovery added!"}</h1>
          <p className="font-bold text-ink-soft">{model.label}</p>
          <p className="text-3xl font-black text-go-dark">{result.duplicate ? "No new XP" : `+${result.xp_awarded} XP`}</p>
          <p className="text-sm font-semibold text-ink-mute">{result.duplicate ? "A repeat sighting gets a log entry but no repeat discovery points." : "This is private by default. A recognition result is never proof of ownership."}</p>
          <Link to={`/explore/${model.id}`} className="btn-go w-full">View passport</Link>
          <button className="btn-ghost w-full" onClick={() => { setResult(null); setModel(null); setFile(null); }}>Capture another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Capture a sighting" sub="Spot something on the road? Add it to your collection. Only capture when you're safely stationary. License plates should be blurred before sharing." />
      <Callout tone="info" title="Photos stay on your device in this demo"><span className="flex gap-2"><EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />License plates should be blurred before sharing. Server-side plate and face redaction plus model suggestion arrive in the pilot. For now you pick the model yourself, and nothing is uploaded.</span></Callout>
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          {url ? <img src={url} alt="Your selected photo preview" className="h-28 w-28 rounded-2xl border-2 border-ink/10 object-cover" /> : <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-ink/20 text-ink-mute"><Camera className="h-8 w-8" aria-hidden /></div>}
          <div>
            <label htmlFor="photo" className="btn-ghost cursor-pointer"><Camera className="h-5 w-5" aria-hidden />{file ? "Change photo" : "Take or choose a photo"}</label>
            <input id="photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="help">Optional. Uses only the one photo you select.</p>
          </div>
        </div>
        <div><span className="label">Which model is it?</span><ModelPicker id="cap-model" value={model?.id} onPick={setModel} compact /></div>
        <div className="flex items-center gap-2 rounded-2xl bg-go-light/50 p-3 text-sm font-extrabold text-go-dark"><ShieldCheck className="h-5 w-5" aria-hidden /> Private by default. No public plate, location or finance data.</div>
        <button className="btn-go w-full" disabled={!model || add.isPending} onClick={submit}>{add.isPending ? "Adding…" : "Add to my collection"}</button>
      </section>
    </div>
  );
}
