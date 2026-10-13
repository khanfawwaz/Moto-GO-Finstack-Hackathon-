import { Trophy } from "lucide-react";
import { ProgressBar } from "./ui";
import type { Progress } from "@/api/types";

export function PointsSummary({ progress }: { progress: Progress }) {
  return <section className="card mb-5 space-y-3" aria-label="Your points and level">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-extrabold uppercase text-sun-dark"><Trophy className="h-5 w-5" aria-hidden /> Level {progress.level} · {progress.title}</p><p className="mt-1 text-4xl font-black text-sun-dark">{progress.xp.toLocaleString("en-IN")} <span className="text-base">points</span></p></div><p className="text-sm font-bold text-ink-soft">{Math.max(0, progress.next_at - progress.xp).toLocaleString("en-IN")} to Level {progress.level + 1}</p></div>
    <ProgressBar value={progress.xp % 1000} max={1000} label="Progress to next level" />
    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">{[["Own", "2,000 + value bonus"], ["Rent", "+500"], ["Test drive", "+250"], ["Spot", "+50"]].map(([label, points]) => <p key={label} className="rounded-xl border border-ink/10 p-2"><span className="block text-xs text-ink-mute">{label}</span><span className="font-black text-go-dark">{points}</span></p>)}</div>
  </section>;
}
