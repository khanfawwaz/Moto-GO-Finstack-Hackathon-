import { Binoculars, Bookmark, Bike, Flag, Key, KeyRound, Navigation, Trophy } from "lucide-react";
import { cx } from "@/components/ui";

export const BADGES: Record<string, { label: string; icon: typeof Bookmark; tone: string }> = {
  spotted: { label: "Spotted", icon: Binoculars, tone: "bg-sky-light text-sky-dark" },
  saved: { label: "Saved", icon: Bookmark, tone: "bg-sun-light text-sun-dark" },
  experienced: { label: "Experienced", icon: Flag, tone: "bg-go-light text-go-dark" },
  ridden: { label: "Rode", icon: Bike, tone: "bg-go-light text-go-dark" },
  driven: { label: "Drove", icon: Navigation, tone: "bg-go-light text-go-dark" },
  test_driven: { label: "Driven", icon: Trophy, tone: "bg-coral-light text-coral-dark" },
  owned: { label: "Owned", icon: Key, tone: "bg-ink text-white" },
  owned_past: { label: "Owned before", icon: KeyRound, tone: "bg-ink/10 text-ink" },
  past_owned: { label: "Owned before", icon: KeyRound, tone: "bg-ink/10 text-ink" },
  rented: { label: "Rented", icon: Bike, tone: "bg-go-light text-go-dark" },
  short_rental: { label: "Short rental", icon: KeyRound, tone: "bg-go-light text-go-dark" },
  long_rental: { label: "Long rental", icon: KeyRound, tone: "bg-go-light text-go-dark" },
};

export function BadgeChips({ badges, size = "sm" }: { badges: string[]; size?: "sm" | "xs" }) {
  if (!badges.length) return <span className="text-xs font-bold text-ink-mute">Not yet discovered</span>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Badges">
      {badges.filter((b) => BADGES[b]).map((b) => {
        const { label, icon: I, tone } = BADGES[b];
        return <li key={b} className={cx("chip", tone, size === "xs" && "!px-2 !py-0.5 !text-[11px]")}><I className="h-3 w-3" aria-hidden />{label}</li>;
      })}
    </ul>
  );
}

export const isDiscovered = (badges: string[]) => badges.some((b) => ["spotted", "experienced", "ridden", "driven", "rented", "test_driven", "past_owned", "owned", "owned_past"].includes(b));
export const specLine = (s: Record<string, string | number>) =>
  [s.cc ? `${s.cc} cc` : null, s.range ? `${s.range} range` : null, s.bhp ? `${s.bhp} bhp` : null, s.eff ?? null].filter(Boolean).join(" · ");
