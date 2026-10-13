import { Check, Flag, KeyRound, Trophy } from "lucide-react";

export const journeyStages = (badges: string[]) => [
  { label: "Test drive", done: badges.includes("test_driven"), icon: Flag },
  { label: "Rent", done: badges.some(b => ["rented", "short_rental", "long_rental"].includes(b)), icon: KeyRound },
  { label: "Own", done: badges.includes("owned") || badges.includes("owned_past"), icon: Trophy },
];

export function JourneyProgress({ badges }: { badges: string[] }) {
  const completed = journeyStages(badges).filter(s => s.done);
  if (!completed.length) return null;
  return <ul className="flex flex-wrap gap-2" aria-label="Completed vehicle experiences">
    {completed.map(({ label, icon: Icon }) => <li key={label} className="inline-flex items-center gap-1 rounded-full border border-go/25 bg-go-light px-2 py-1 text-xs font-bold text-go-dark">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />{label === "Test drive" ? "Driven" : label === "Rent" ? "Rented" : "Owned"}<Check className="h-3 w-3" aria-hidden />
    </li>)}
  </ul>;
}
