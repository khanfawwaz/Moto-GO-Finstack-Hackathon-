import type { Model } from "@/api/types";

/** Body/riding style is independent of fuel type and the catalogue's purpose segment. */
export function vehicleGroup(m: Model): string {
  const name = m.model.toLowerCase();
  if (m.type === "car") {
    if (/innova/.test(name)) return "MPVs";
    if (/city|virtus/.test(name)) return "Sedans";
    if (/punch|creta|thar|scorpio|jimny|nexon|xuv|macan|cayenne/.test(name)) return "SUVs & crossovers";
    if (/alto|swift|i20|cooper|comet/.test(name)) return "Hatchbacks";
    return "Other cars";
  }
  if (m.type === "scooter") return m.segment === "ev" ? "Electric scooters" : m.segment === "performance" ? "Sport scooters" : m.segment === "touring" ? "Touring & classic scooters" : "Everyday scooters";
  if (m.segment === "ev") return "Electric bikes";
  if (/scrambler/.test(name)) return "Scramblers";
  if (m.segment === "adventure") return "Adventure & dual-sport";
  if (/super meteor|meteor/.test(name)) return "Cruisers";
  if (/r15|rr 310/.test(name)) return "Sport bikes";
  if (/dominar/.test(name)) return "Sport tourers";
  if (m.segment === "commute") return "Commuter bikes";
  return "Roadsters & street bikes";
}

export const hasSeen = (badges: string[]) => badges.some(b => ["spotted", "test_driven", "driven", "ridden", "rented", "short_rental", "long_rental", "owned", "owned_past", "past_owned", "experienced"].includes(b));

/** Catalogue midpoint, 20% down, 36 months, illustrative 11.5% reducing-balance interest. */
export function catalogueEmi(m: Model): number {
  const principal = ((m.price_low + m.price_high) / 2) * .8;
  const monthlyRate = .115 / 12;
  const factor = (1 + monthlyRate) ** 36;
  return Math.round(principal * monthlyRate * factor / (factor - 1));
}
