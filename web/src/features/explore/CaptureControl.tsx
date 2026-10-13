import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Camera, ShieldAlert } from "lucide-react";
import { api } from "@/api/client";
import { useInvalidate, useMe } from "@/api/hooks";
import type { Model } from "@/api/types";
import { ErrorBox, useToast } from "@/components/ui";

export function CaptureControl({ model, selecting, onSelect }: { model?: Model; selecting: boolean; onSelect: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const { data: me } = useMe();
  const nav = useNavigate();
  const inv = useInvalidate();
  const toast = useToast();
  useEffect(() => { if (!file) { setUrl(""); return; } const src = URL.createObjectURL(file); setUrl(src); return () => URL.revokeObjectURL(src); }, [file]);
  const capture = useMutation({
    mutationFn: () => api<{ duplicate: boolean; xp_awarded: number }>("/activities", { body: { model_id: model!.id, activity: "spotted" } }),
    onSuccess: result => { inv("collection", "passport", "me", "garage"); toast(result.duplicate ? "Already spotted. No repeat points." : `Sighting saved · +${result.xp_awarded} points`); setFile(null); },
  });
  return <section id="capture" className="card explore-capture mb-6 scroll-mt-24 space-y-3" aria-label="Capture a sighting">
    <div className="flex flex-wrap items-center gap-3">
      {url && <img src={url} alt="Your selected sighting" className="h-20 w-24 rounded-xl object-cover" />}
      <div className="min-w-0 flex-1"><h2 className="flex items-center gap-2"><Camera className="h-5 w-5" aria-hidden /> Capture a sighting</h2><p className="text-sm text-ink-soft">{selecting ? "Tap a vehicle in the catalogue below to identify your sighting." : model ? `Selected: ${model.label}` : "Take a photo, then choose its vehicle from the catalogue below."}</p></div>
      <label className="btn-ghost cursor-pointer" htmlFor="explore-photo">{file ? "Change photo" : "Take / choose photo"}</label><input id="explore-photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f?.type.startsWith("image/")) setFile(f); }} />
      <button className="btn-ghost" aria-pressed={selecting} onClick={onSelect}>{model ? "Change vehicle" : "Select vehicle below"}</button>
      <button className="btn-go" disabled={!file || !model || capture.isPending} onClick={() => me ? capture.mutate() : nav("/signup", { state: { next: "/explore#capture" } })}>{capture.isPending ? "Saving…" : "Log sighting · +50"}</button>
      {capture.error && <ErrorBox error={capture.error} />}
    </div>
    <p className="flex items-start gap-2 border-t border-ink/10 pt-3 text-xs leading-relaxed text-ink-soft"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sun-dark" aria-hidden /><span><strong className="text-sun-dark">Only capture when safely stationary.</strong> Never photograph while driving or riding. Blur plates and faces before sharing. Demo photos stay on your device and are not uploaded or automatically recognised.</span></p>
  </section>;
}
