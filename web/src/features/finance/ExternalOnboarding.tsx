import { useSyncExternalStore } from "react";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useMe } from "@/api/hooks";
import type { Model } from "@/api/types";
import { cx } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";

export const EXTERNAL_ONBOARDING_URL = "https://preprod-v2-onboarding.web.app/?url=qMMDJ3";
const CHANGE = "motogo:onboarding-handoff";
const memory = new Map<string, string>();

function readStarted(key: string) {
  let value: string | null;
  try { value = localStorage.getItem(key) ?? memory.get(key) ?? null; }
  catch { value = memory.get(key) ?? null; }
  return value && Number.isFinite(Date.parse(value)) ? value : null;
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(CHANGE, callback); };
}
function useExternalOnboarding() {
  const { data: me } = useMe();
  // Only a hand-off timestamp is stored, scoped to this browser/account.
  const key = `motogo:onboarding-started:${me?.id ?? "guest"}`;
  const startedAt = useSyncExternalStore(subscribe, () => readStarted(key), () => null);
  const markStarted = () => {
    const timestamp = startedAt ?? new Date().toISOString();
    memory.set(key, timestamp);
    try { localStorage.setItem(key, timestamp); } catch { /* Private mode: keep this session usable. */ }
    window.dispatchEvent(new Event(CHANGE));
  };
  return { startedAt, markStarted };
}

export function EligibilityLink() {
  const { startedAt, markStarted } = useExternalOnboarding();
  return <a href={EXTERNAL_ONBOARDING_URL} onClick={markStarted} referrerPolicy="no-referrer" className="btn-go w-full text-center sm:w-auto">{startedAt ? "Continue with FinStack" : "Check eligibility with FinStack"}<ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden /></a>;
}

export function EligibilitySection({ model, planParams }: { model?: Model; planParams?: string }) {
  const calculator = model ? `/loans?model=${encodeURIComponent(model.id)}${planParams ? `&${planParams}` : ""}#emi-calculator` : "/loans#emi-calculator";
  return <section id="eligibility" className="card explore-eligibility mb-5 scroll-mt-28 space-y-3 !p-4" aria-label="Loan eligibility">
    <div><h2 className="text-2xl">Check eligibility</h2><p className="mt-1 text-sm text-ink-soft">Find the loans you are eligible for—or work out your monthly payment first.</p></div>
    {model && <div className="flex items-center gap-3 rounded-xl border border-sky/30 p-2"><VehicleImage id={model.id} label={model.label} type={model.type} className="h-12 w-20 rounded-lg object-cover" /><div><p className="text-[10px] uppercase text-ink-mute">Selected vehicle</p><p className="text-lg font-black">{model.label}</p></div></div>}
    <div className="flex flex-wrap gap-2"><Link to={calculator} className="btn-ghost">Loan calculator</Link><EligibilityLink /></div>
    <div className="max-w-2xl"><p className="text-sm font-semibold text-ink-soft">You will be asked to fill out your details and review consent in the FinStack workflow before any credit check or lender assessment.</p><p className="mt-1 text-xs text-ink-mute">The calculator does not check your credit. FinStack opens externally; vehicle details and plan amounts are not sent automatically. Eligibility and offers depend on assessment.</p></div>
  </section>;
}

export function ExternalOnboardingStatus({ className }: { className?: string }) {
  const { startedAt } = useExternalOnboarding();
  if (!startedAt) return null;
  const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(startedAt));
  return <section aria-label="External onboarding status" className={cx("card flex items-start gap-3 !p-4", className)}>
    <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-sky-dark" aria-hidden />
    <div><p role="status" className="font-black text-sky-dark">Onboarding started</p><p className="mt-1 text-xs text-ink-soft">You chose to start external onboarding. Completion and eligibility results are not synced to Moto Go yet.</p><p className="mt-1 text-xs text-ink-mute">Started <time dateTime={startedAt}>{when} IST</time> · Saved on this browser only.</p></div>
  </section>;
}
