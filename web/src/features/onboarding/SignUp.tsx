import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/api/client";
import { useMeta } from "@/api/hooks";
import type { User } from "@/api/types";
import { Logo } from "@/components/AppShell";
import { Callout, DemoBadge, useToast } from "@/components/ui";

const PHONE = /^(\+91)?[\s-]*[6-9][0-9]{9}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function SignUp() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { next?: string; reason?: string } };
  const qc = useQueryClient();
  const toast = useToast();
  const { data: meta } = useMeta();

  const [identifier, setId] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const fail = (e: unknown) => {
    if (e instanceof ApiError) {
      if (e.field) setErrs({ [e.field]: e.message }); else setMsg(e.message);
    } else setMsg("Something went wrong. Please try again.");
  };

  const request = async () => {
    setErrs({}); setMsg(null);
    if (!PHONE.test(identifier.trim()) && !EMAIL.test(identifier.trim())) {
      setErrs({ identifier: "Enter a 10-digit Indian mobile number (starting 6-9) or an email address." });
      return;
    }
    setBusy(true);
    try { await api("/auth/otp/request", { body: { identifier } }); setSent(true); setWait(30); }
    catch (e) { if (e instanceof ApiError && e.code === "resend_too_soon") setSent(true); fail(e); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    const e: Record<string, string> = {};
    if (!/^\d{6}$/.test(code)) e.code = "Enter the 6-digit code.";
    setErrs(e); setMsg(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await api<{ user: User; is_new: boolean }>("/auth/otp/verify", { body: { identifier, code, display_name: name, adult, accept_terms: terms, marketing_opt_in: marketing } });
      qc.setQueryData(["me"], r.user);
      if (r.is_new) nav("/story", { replace: true });
      else { toast(`Welcome back, ${r.user.display_name}`); nav(loc.state?.next ?? "/garage", { replace: true }); }
    } catch (x) { fail(x); } finally { setBusy(false); }
  };

  return (
    <div className="map-bg min-h-dvh px-4 py-6">
      <div className="mx-auto mb-6 flex max-w-md items-center justify-between"><Logo /><DemoBadge /></div>
      <div className="card mx-auto max-w-md !p-6">
        <h1 className="text-2xl">Create your profile</h1>
        <p className="mt-1 font-semibold text-ink-soft">Save your vehicles, dream shortlist and experience progress privately. No financial details needed here.</p>
        {loc.state?.reason && <div className="mt-4"><Callout tone="info">{loc.state.reason}</Callout></div>}

        <div className="mt-5 space-y-5">
          <div>
            <label htmlFor="identifier" className="label">Mobile number or email</label>
            <input id="identifier" className={`input ${errs.identifier ? "input-err" : ""}`} value={identifier} onChange={(e) => setId(e.target.value)}
              autoComplete="username" inputMode="email" disabled={sent} placeholder="98XXXXXXXX or you@example.com" />
            {errs.identifier && <p className="err" role="alert">{errs.identifier}</p>}
          </div>

          {!sent ? (
            <button className="btn-go w-full" onClick={request} disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
          ) : (
            <>
              <div>
                <label htmlFor="code" className="label">6-digit code</label>
                <input id="code" className={`input tracking-[0.4em] ${errs.code ? "input-err" : ""}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                {errs.code && <p className="err" role="alert">{errs.code}</p>}
                <p className="help">
                  {meta?.otp_hint && <>Demo: the code is <b>{meta.otp_hint}</b>. </>}
                  Expires in 5 minutes.{" "}
                  {wait > 0 ? <span>Resend in {wait}s</span> : <button className="font-extrabold text-sky-dark underline" onClick={() => { setSent(false); setCode(""); void request(); }}>Resend code</button>}
                </p>
              </div>
              <div>
                <label htmlFor="name" className="label">Display name <span className="font-semibold text-ink-mute">(new accounts)</span></label>
                <input id="name" className={`input ${errs.display_name ? "input-err" : ""}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" />
                {errs.display_name && <p className="err" role="alert">{errs.display_name}</p>}
              </div>
              <div className="space-y-2.5">
                <Check id="adult" checked={adult} onChange={setAdult} error={errs.adult}>I am 18 or older.</Check>
                <Check id="terms" checked={terms} onChange={setTerms} error={errs.accept_terms}>I accept the terms and privacy notice.</Check>
                <Check id="mkt" checked={marketing} onChange={setMarketing}>Send me product updates <span className="text-ink-mute">(optional)</span>.</Check>
              </div>
              <button className="btn-go w-full" onClick={verify} disabled={busy}>{busy ? "Checking…" : "Continue"}</button>
              <button className="btn-quiet w-full" onClick={() => { setSent(false); setCode(""); setErrs({}); setMsg(null); }}>Use a different number or email</button>
            </>
          )}
          {msg && <p className="err" role="alert">{msg}</p>}
        </div>
        <p className="mt-5 text-center text-sm font-bold text-ink-mute">Already have an account? Enter your number and code: we'll recognise you.</p>
      </div>
      <p className="mt-5 text-center"><Link to="/explore" className="font-extrabold text-ink-soft underline">Explore as a guest</Link></p>
    </div>
  );
}

function Check({ id, checked, onChange, error, children }: { id: string; checked: boolean; onChange: (b: boolean) => void; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 font-bold ${error ? "border-coral bg-coral-light/30" : "border-ink/15"}`}>
        <input id={id} type="checkbox" className="h-5 w-5 accent-go" checked={checked} onChange={(e) => onChange(e.target.checked)} /> <span>{children}</span>
      </label>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
