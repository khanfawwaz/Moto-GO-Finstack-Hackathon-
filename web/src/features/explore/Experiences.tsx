import { Link, useSearchParams } from "react-router-dom";
import { CalendarCheck, Clock3, ExternalLink, KeyRound, MapPin, Sparkles } from "lucide-react";
import { useCollection, usePassport } from "@/api/hooks";
import { Callout, PageHeader } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { shortInr } from "@/lib/format";

type Showroom = { name: string; area: string; kind: string; models: string; href: string; focus: string; focusId?: string; type: "car" | "bike" | "scooter" };

// Official dealer pages only. This guide deliberately stays within Bengaluru.
const BENGALURU_SHOWROOMS: Showroom[] = [
  { name: "Porsche Centre Bengaluru", area: "Seshadripuram · Whitefield", kind: "Supercar and EV", models: "911 · Taycan · Macan · Cayenne", href: "https://dealer.porsche.com/in/bengaluru", focus: "Porsche Taycan", type: "car" },
  { name: "JSP BMW Motorrad", area: "Koramangala · Mahadevapura", kind: "Performance and adventure bikes", models: "S 1000 RR · F 900 GS · R 1300 GS", href: "https://www.bmw-motorrad.in/jspmotorrad-bengaluru/en/home.html", focus: "BMW S 1000 RR", type: "bike" },
  { name: "Keerthi Triumph", area: "JP Nagar · HBR Layout · Residency Road", kind: "Modern classics and adventure", models: "Speed 400 · Scrambler 400 X · Tiger", href: "https://www.triumphmotorcycles.in/dealers/dealer-search", focus: "Triumph Scrambler 400 X", focusId: "triumph-scrambler-400-x", type: "bike" },
  { name: "Volkswagen Bengaluru", area: "Bengaluru locations", kind: "Performance sedan", models: "Virtus GT", href: "https://www.volkswagen.co.in/app/site/pages/virtus-price-in-bangalore/", focus: "Volkswagen Virtus GT", focusId: "volkswagen-virtus-gt", type: "car" },
];

const ROADMAP_HIGHLIGHTS = ["mini-cooper-s", "volkswagen-virtus-gt", "triumph-scrambler-400-x", "bmw-g-310-gs"];

function vehicleOfTheDayIndex(length: number) {
  const today = new Date().toISOString().slice(0, 10);
  return [...today].reduce((total, char) => total + char.charCodeAt(0), 0) % length;
}

/** Dealer cards are official handoffs; no visit or test-drive availability is invented. */
export default function Experiences() {
  const [sp] = useSearchParams();
  const model = sp.get("model");
  const { data } = usePassport(model ?? "");
  const { data: collection } = useCollection();
  const highlights = ROADMAP_HIGHLIGHTS.map((id) => collection?.models.find((m) => m.id === id)).filter(Boolean);
  const vehicleOfTheDay = collection?.models.length ? collection.models[vehicleOfTheDayIndex(collection.models.length)] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Bengaluru showroom experiences" sub={model && data ? `See the ${data.model.label} in person, or browse the most exciting showroom stops in Bengaluru.` : "High-performance cars and bikes to see in person — Bengaluru only."} />

      <section aria-label="Rental options" className="relative overflow-hidden rounded-3xl border border-go/30 bg-gradient-to-r from-go-dark via-ink to-sky-dark p-5 text-white shadow-chunk md:p-6">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-go/25 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.16em] text-sun-light"><KeyRound className="h-4 w-4" aria-hidden /> Rental lane</p>
            <h2 className="mt-1 text-2xl font-black">Need the keys before you own them?</h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-white/75">Try the vehicle you are working towards, whether it is for a weekend blast or a longer everyday run.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[410px]">
            <Link to="/explore" className="rounded-2xl border border-white/15 bg-white/10 p-3 transition hover:bg-white/15">
              <span className="flex items-center gap-2 text-sm font-extrabold"><Clock3 className="h-4 w-4 text-sun-light" aria-hidden /> Short-term rental</span>
              <span className="mt-1 block text-xs font-semibold text-white/65">A day, a weekend, or a special drive.</span>
            </Link>
            <Link to="/roadmap" className="rounded-2xl border border-white/15 bg-white/10 p-3 transition hover:bg-white/15">
              <span className="flex items-center gap-2 text-sm font-extrabold"><CalendarCheck className="h-4 w-4 text-go-light" aria-hidden /> Long-term rental</span>
              <span className="mt-1 block text-xs font-semibold text-white/65">Live with your next vehicle for longer.</span>
            </Link>
          </div>
        </div>
      </section>

      {vehicleOfTheDay && <section aria-labelledby="vehicle-of-the-day" className="card group overflow-hidden !p-0 md:grid md:grid-cols-[.92fr_1.08fr]">
        <div className="relative min-h-60 overflow-hidden bg-ink">
          <VehicleImage id={vehicleOfTheDay.id} label={vehicleOfTheDay.label} type={vehicleOfTheDay.type} priority className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
          <p className="absolute bottom-4 left-5 font-mono text-xs font-bold uppercase tracking-[.18em] text-sun-light">Daily spec · {vehicleOfTheDay.segment}</p>
        </div>
        <div className="flex flex-col justify-center p-6 md:p-8">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.16em] text-go-dark"><Sparkles className="h-4 w-4" aria-hidden /> Vehicle of the day</p>
          <h2 id="vehicle-of-the-day" className="mt-1 text-3xl font-black">{vehicleOfTheDay.label}</h2>
          <p className="mt-2 text-sm font-semibold text-ink-soft">A fresh, daily pick from the Moto Go catalogue: one machine worth a closer look before your next showroom run.</p>
          <p className="mt-4 font-mono text-sm font-bold text-ink">{shortInr(vehicleOfTheDay.price_low)} – {shortInr(vehicleOfTheDay.price_high)} <span className="font-sans text-xs font-semibold text-ink-soft">estimated new price</span></p>
          <div className="mt-5"><Link to={`/explore/${vehicleOfTheDay.id}`} className="btn-go">View vehicle details</Link></div>
        </div>
      </section>}

      <section className="grid overflow-hidden rounded-3xl bg-ink text-white shadow-chunk md:grid-cols-[1.1fr_.9fr]">
        <div className="flex min-h-64 flex-col justify-center p-6 md:p-8">
          <p className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-sun-light"><Sparkles className="h-4 w-4" aria-hidden /> Weekend inspiration</p>
          <h2 className="text-3xl font-black">Step into the machines on your Roadmap.</h2>
          <p className="mt-2 font-semibold text-white/75">Start at a Bengaluru showroom, compare the stance, sound and seating, then choose the vehicle you want to make a goal.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link to="/roadmap" className="btn-go">Explore Roadmap</Link><Link to="/explore/triumph-scrambler-400-x" className="btn-ghost">See Scrambler 400 X</Link></div>
        </div>
        <div className="relative min-h-56 overflow-hidden bg-go-dark">
          <VehicleImage id="triumph-scrambler-400-x" label="Triumph Scrambler 400 X" type="bike" priority className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-transparent to-transparent" />
          <p className="absolute inset-x-0 bottom-0 p-5 text-sm font-black">Triumph Scrambler 400 X · Bengaluru showroom favourite</p>
        </div>
      </section>

      <section aria-labelledby="showrooms-heading">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="showrooms-heading" className="text-xl">Bengaluru showrooms</h2><p className="text-sm font-semibold text-ink-soft">Official dealer handoffs, grouped by the kind of experience.</p></div><span className="chip bg-sky-light text-sky-dark">Bengaluru only</span></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {BENGALURU_SHOWROOMS.map((s) => (
            <article key={s.name} className="card group relative min-h-[230px] overflow-hidden !p-0">
              <VehicleImage id={s.focusId} label={s.focus} type={s.type} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/10" />
              <div className="relative flex min-h-[230px] flex-col justify-end p-5 text-white">
                <p className="text-xs font-extrabold uppercase tracking-wide text-sun-light">{s.kind}</p>
                <h3 className="mt-1 text-xl font-black">{s.name}</h3>
                <p className="mt-1 flex items-center gap-1 text-sm font-bold text-white/80"><MapPin className="h-4 w-4" aria-hidden /> {s.area}</p>
                <p className="mt-2 text-sm font-semibold text-white/75">{s.models}</p>
                <a href={s.href} target="_blank" rel="noreferrer" className="btn-go mt-4 w-fit !min-h-[40px] !px-3 text-sm"><CalendarCheck className="h-4 w-4" aria-hidden /> Explore official showroom <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="roadmap-highlights" className="space-y-3">
        <div><h2 id="roadmap-highlights" className="text-xl">Roadmap show-stoppers</h2><p className="text-sm font-semibold text-ink-soft">High-end models already in the Moto Go Roadmap catalogue.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((m) => m && (
            <Link key={m.id} to={`/explore/${m.id}`} className="card group !p-3 transition hover:border-go/60">
              <VehicleImage id={m.id} label={m.label} type={m.type} className="h-32 w-full rounded-xl object-cover" />
              <p className="mt-3 truncate font-black">{m.label}</p>
              <p className="text-sm font-bold text-ink-soft">{shortInr(m.price_low)} – {shortInr(m.price_high)}</p>
              <span className="mt-2 inline-block text-sm font-extrabold text-go-dark">Open Roadmap model →</span>
            </Link>
          ))}
        </div>
      </section>

      <Callout tone="info" title="Visits and test rides are arranged by each dealer">Use the official showroom link for current inventory, opening hours and any test-ride request. Moto Go does not create a booking or share your details with a dealer.</Callout>
      {model && <p className="text-sm font-semibold text-ink-soft">Want to record a ride you have already completed? <Link to={`/explore/${model}`} className="font-extrabold text-sky-dark underline">Open the vehicle passport</Link>.</p>}
    </div>
  );
}
