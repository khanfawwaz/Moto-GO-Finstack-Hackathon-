import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Download, LogOut, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { useCollection, useConsents, useInvalidate, useLogout, useMe } from "@/api/hooks";
import { cx, ErrorBox, PageHeader, ProgressBar, Spinner, useToast } from "@/components/ui";
import { dateFmt } from "@/lib/format";

export default function Profile() {
  const { data: me } = useMe();
  const { data: consents, error, refetch } = useConsents();
  const collection = useCollection();
  const inv = useInvalidate();
  const toast = useToast();
  const nav = useNavigate();
  const logout = useLogout();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const withdraw = useMutation({ mutationFn: (id: string) => api(`/consents/${id}/withdraw`, { body: {} }), onSuccess: () => { inv("consents", "application"); toast("Consent withdrawn. It no longer allows any provider calls."); } });
  const marketing = useMutation({ mutationFn: (on: boolean) => api(`/me/marketing?opt_in=${on}`, { body: {} }), onSuccess: () => inv("consents") });
  const del = useMutation({ mutationFn: () => api<{ message: string }>("/me/delete-request", { body: {} }), onSuccess: (r) => { toast(r.message); setConfirmDelete(false); } });

  const exportData = async () => {
    const data = await api("/me/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "my-moto-go-data.json" });
    a.click(); URL.revokeObjectURL(url);
  };

  if (!me) return <Spinner />;
  const count = (badges: string[], type?: string) => collection.data?.models.filter(m => (!type || m.type === type) && m.badges.some(b => badges.includes(b))).length ?? 0;
  const mktOn = consents?.items.some((c) => c.type === "marketing" && !c.withdrawn_at);
  return (
    <>
      <PageHeader title="Settings" sub={`${me.display_name} · Your account, activity and privacy` }
        action={<button className="btn-ghost" onClick={async () => { await logout.mutateAsync(); nav("/"); }}><LogOut className="h-4 w-4" aria-hidden /> Sign out</button>} />
      <div className="grid gap-5 md:grid-cols-2">
        <section id="progress" className="card scroll-mt-24 space-y-3">
          <h2 className="text-lg">Level & rewards</h2>
          <p className="font-black">Lv {me.level} · {me.title} · {me.xp} XP</p>
          <ProgressBar value={me.xp % 1000} max={1000} label="Progress to next level" tone="sun" />
          <p className="help">Owning earns 2,000 points plus a value bonus, renting 500, test drives 250 and sightings 50. Repeat logs earn no extra points; points do not affect lender eligibility.</p>
        </section>

        <section className="card space-y-3" aria-label="Onboarding profile">
          <h2 className="text-lg">Your profile</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">{[["Name", me.display_name], ["Phone / email", me.phone ?? me.email ?? "Not provided"], ["City", me.profile?.city ?? "Not provided"], ["Interests", me.profile?.interests.join(", ") || "Not provided"]].map(([label,value]) => <div key={label}><dt className="text-xs text-ink-mute">{label}</dt><dd className="font-bold">{value}</dd></div>)}</dl>
          <Link to="/loans" className="btn-ghost">Loans, insurance & offers</Link>
        </section>
        <section className="card space-y-3 md:col-span-2" aria-label="Activity statistics">
          <h2 className="text-lg">Your activity</h2>
          {collection.error ? <ErrorBox error={collection.error} retry={() => collection.refetch()} /> : collection.isLoading ? <Spinner /> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Cars spotted",count(["spotted"],"car")],["All vehicles spotted",count(["spotted"])],["Test drives",count(["test_driven"])],["Vehicles rented",count(["rented","short_rental","long_rental"])],["Short rentals",count(["short_rental"])],["Long rentals",count(["long_rental"])]].map(([label,value]) => <div key={String(label)} className="rounded-xl border border-ink/10 p-3"><p className="text-xs text-ink-mute">{label}</p><p className="text-2xl font-black text-go-dark">{value}</p></div>)}</div>}
          <p className="help">Unique models with saved, self-reported experiences.</p>
        </section>

        <section className="card space-y-3 md:col-span-2" aria-label="Consents">
          <h2 className="text-lg">Your consents</h2>
          <p className="text-sm font-semibold text-ink-soft">Each is logged with purpose, recipient, version and time. Withdrawing blocks further provider calls for that purpose.</p>
          {error ? <ErrorBox error={error} retry={() => refetch()} /> : (
            <ul className="divide-y divide-ink/10">
              {consents?.items.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1"><p className="font-black capitalize">{c.type.replace("_", " ")} <span className="text-xs font-bold text-ink-mute">· {c.text_version}</span></p>
                    <p className="text-sm font-semibold text-ink-soft">{c.purpose}, to {c.recipient}</p>
                    <p className="text-xs font-bold text-ink-mute">Given {dateFmt(c.granted_at)}{c.withdrawn_at && ` · withdrawn ${dateFmt(c.withdrawn_at)}`}</p></div>
                  {c.withdrawn_at ? <span className="chip bg-ink/10 text-ink-soft">Withdrawn</span>
                    : !["terms", "adult"].includes(c.type) ? <button className="btn-ghost" disabled={withdraw.isPending} onClick={() => withdraw.mutate(c.id)}>Withdraw</button>
                    : <span className="chip bg-go-light text-go-dark">Active</span>}
                </li>))}
            </ul>
          )}
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink/15 p-3 font-bold">
            <input type="checkbox" className="h-5 w-5 accent-go" checked={!!mktOn} onChange={(e) => marketing.mutate(e.target.checked)} /> Send me product updates (off by default)
          </label>
        </section>

        <section className="card space-y-3 md:col-span-2">
          <h2 className="text-lg">Your data</h2>
          <div className="flex flex-wrap gap-3">
            <button className="btn-ghost" onClick={exportData}><Download className="h-4 w-4" aria-hidden /> Download my data</button>
            {!confirmDelete ? <button className="btn-ghost text-coral-dark" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" aria-hidden /> Request deletion</button> : (
              <span className={cx("flex flex-wrap items-center gap-2 rounded-2xl border-2 border-coral/40 p-2")}>
                <span className="px-2 text-sm font-bold">Ask support to delete your account and data?</span>
                <button className="btn-coral" disabled={del.isPending} onClick={() => del.mutate()}>Yes, request deletion</button>
                <button className="btn-quiet" onClick={() => setConfirmDelete(false)}>Keep my account</button>
              </span>)}
          </div>
          <p className="help">Application documents may be kept for the period the lender is required to retain them. Identity numbers are encrypted and left out of the export.</p>
        </section>
      </div>
    </>
  );
}
