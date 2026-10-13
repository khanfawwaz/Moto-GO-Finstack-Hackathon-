import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Compass, ShieldCheck, Wrench } from "lucide-react";
import { useMe } from "@/api/hooks";
import { Logo } from "@/components/AppShell";
import { DemoBadge } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { inrRange } from "@/lib/format";

export default function Welcome() {
  const { data: me, isLoading } = useMe();
  if (!isLoading && me) return <Navigate to="/garage" replace />;
  return (
    <div className="min-h-dvh">
      <section className="map-bg relative overflow-hidden px-4 pb-16 pt-5 md:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between"><Logo /><DemoBadge /></div>
        <div className="mx-auto mt-10 grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="text-4xl leading-[1.05] sm:text-5xl">Your automotive life, <span className="text-go-dark">mapped.</span></h1>
            <p className="mt-4 max-w-md text-lg font-bold text-ink-soft">
              Keep track of your vehicle, discover your next drive, and try, rent or own it at your pace. No paperwork to start.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-go text-base">Build my garage <ArrowRight className="h-5 w-5" aria-hidden /></Link>
              <Link to="/explore" className="btn-ghost text-base"><Compass className="h-5 w-5" aria-hidden /> Explore first</Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm font-bold text-ink-soft">
              <ShieldCheck className="h-5 w-5 text-go-dark" aria-hidden /> Browsing needs no PAN, no credit check, no loan enquiry.
            </p>
          </div>

          <div className="relative" aria-label="Sample garage">
            <div className="card animate-floaty rotate-1 !p-6">
              <p className="chip mb-3 bg-sky-light text-sky-dark">Sample garage</p>
              <div className="flex items-center gap-4">
                <VehicleImage id="suzuki-access-125" label="Suzuki Access 125" type="scooter" className="h-16 w-24 rounded-2xl object-cover" priority />
                <div>
                  <p className="text-xl font-black">Suzuki Access 125</p>
                  <p className="text-sm font-bold text-ink-mute">2021 · Pune · good condition</p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <div><dt className="text-xs font-extrabold uppercase text-ink-mute">Estimated value</dt><dd className="text-lg font-black">{inrRange(58000, 68000)}</dd></div>
                <div><dt className="text-xs font-extrabold uppercase text-ink-mute">Loan left</dt><dd className="text-lg font-black">₹18,000</dd></div>
                <div className="col-span-2 rounded-2xl bg-go-light/60 p-3"><dt className="text-xs font-extrabold uppercase text-go-dark">Estimated equity</dt>
                  <dd className="text-2xl font-black text-go-dark">{inrRange(40000, 50000)}</dd>
                  <dd className="text-xs font-bold text-ink-soft">Demo curve · medium confidence · illustrative</dd></div>
              </dl>
              <p className="mt-4 text-sm font-bold text-ink-soft">Explore commute, touring, adventure, performance and EV options.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-12 md:grid-cols-3 md:px-10">
        {[
          [Wrench, "Useful every week", "Your vehicle value, service and insurance reminders, and a shortlist of what comes next."],
          [Compass, "Plan, don't pressure", "Compare saving, buying used, selling and financing on assumptions you can see."],
          [ShieldCheck, "Finance only when you ask", "Opt in, see the lender and purpose first, and only provide what is missing."],
        ].map(([Icon, t, b]) => {
          const I = Icon as typeof Wrench;
          return (
            <div key={t as string} className="card">
              <I className="mb-3 h-7 w-7 text-go-dark" aria-hidden />
              <h2 className="text-lg">{t as string}</h2>
              <p className="mt-1 font-semibold text-ink-soft">{b as string}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
