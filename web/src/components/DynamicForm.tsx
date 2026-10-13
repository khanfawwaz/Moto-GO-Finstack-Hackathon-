import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Doc, FieldSpec, StepSpec } from "@/api/types";
import { ApiError } from "@/api/client";
import { isMasked, isVisible, zodFromSpec, cleanValues } from "@/lib/zodFromSpec";
import { isBusy, useUploads } from "@/lib/upload";
import { ModelPicker } from "./ModelPicker";
import { UploadField } from "./UploadField";
import { cx } from "./ui";

interface Props {
  spec: StepSpec;
  applicationId?: string;
  defaults?: Record<string, unknown>;
  submitLabel?: string;
  busy?: boolean;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
  onDraft?: (values: Record<string, unknown>) => void;
  extraActions?: React.ReactNode;
  serverError?: unknown;
}

/** Renders any lender-configured step from its field spec. No field is hard-coded in the UI. */
export function DynamicForm({ spec, applicationId, defaults, submitLabel = "Continue", busy, onSubmit, onDraft, extraActions, serverError }: Props) {
  const schema = useMemo(() => zodFromSpec(spec), [spec]);
  const initial = useMemo(() => {
    const v: Record<string, unknown> = {};
    for (const f of spec.fields) v[f.name] = (spec.values[f.name] ?? defaults?.[f.name] ?? (f.type === "checkbox" ? false : ""));
    return v;
  }, [spec, defaults]);
  const form = useForm<FieldValues>({ resolver: zodResolver(schema), defaultValues: initial, mode: "onTouched" });
  const { register, control, handleSubmit, watch, setError, formState: { errors, isSubmitting, isDirty } } = form;
  const values = watch();
  const uploads = useUploads((s) => s.items);
  const uploading = Object.values(uploads).some(isBusy);

  // surface server-side field errors (the server validates the same spec again)
  useEffect(() => {
    if (serverError instanceof ApiError) serverError.errors.forEach((e) => setError(e.field, { message: e.message }));
  }, [serverError, setError]);

  // autosave drafts (to the server only, never to browser storage)
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!onDraft || !isDirty) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onDraft(cleanValues(spec, values)), 900);
    return () => clearTimeout(timer.current);
  }, [JSON.stringify(values)]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = handleSubmit(async (v) => { await onSubmit(cleanValues(spec, v)); });
  const err = (n: string) => (errors[n]?.message as string | undefined);

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {spec.fields.filter((f) => isVisible(f, values)).map((f) => (
        <FieldRow key={f.name} f={f} register={register} control={control} error={err(f.name)} values={values} applicationId={applicationId} setValue={form.setValue} />
      ))}
      {serverError instanceof ApiError && !serverError.errors.length && <p role="alert" className="err">{serverError.message}</p>}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" className="btn-go" disabled={busy || isSubmitting || uploading}>
          {uploading ? "Waiting for upload…" : isSubmitting || busy ? "Saving…" : submitLabel}
        </button>
        {extraActions}
      </div>
    </form>
  );
}

function FieldRow({ f, register, control, error, values, applicationId, setValue }: {
  f: FieldSpec; register: ReturnType<typeof useForm>["register"]; control: ReturnType<typeof useForm>["control"];
  error?: string; values: Record<string, unknown>; applicationId?: string; setValue: ReturnType<typeof useForm>["setValue"];
}) {
  const id = `f-${f.name}`;
  const common = { id, "aria-invalid": !!error, "aria-describedby": error ? `${id}-err` : f.help ? `${id}-help` : undefined };
  const help = f.help && <p id={`${id}-help`} className="help">{f.help}</p>;
  const errEl = error && <p id={`${id}-err`} className="err" role="alert">{error}</p>;

  switch (f.type) {
    case "checkbox":
      return (
        <div>
          <label className={cx("flex min-h-[44px] cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 font-bold", error ? "border-coral bg-coral-light/30" : "border-ink/15 bg-white")}>
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-go" {...register(f.name)} {...common} />
            <span>{f.label}{f.consent && <span className="mt-1 block text-xs font-semibold text-ink-mute">Recorded with purpose, recipient, version and time. You can withdraw it from Profile.</span>}</span>
          </label>
          {errEl}
        </div>
      );
    case "radio":
      return (
        <fieldset aria-describedby={error ? `${id}-err` : undefined}>
          <legend className="label">{f.label}</legend>
          <div className="space-y-2">
            {f.options?.map((o) => (
              <label key={o.value} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink/15 bg-white p-3.5 font-bold has-[:checked]:border-go has-[:checked]:bg-go-light/40">
                <input type="radio" value={o.value} className="h-5 w-5 accent-go" {...register(f.name)} /> {o.label}
              </label>
            ))}
          </div>
          {help}{errEl}
        </fieldset>
      );
    case "select":
      return (
        <div>
          <label htmlFor={id} className="label">{f.label}</label>
          <select className={cx("input", error && "input-err")} {...register(f.name)} {...common}>
            <option value="">Choose…</option>
            {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {help}{errEl}
        </div>
      );
    case "textarea":
      return (
        <div>
          <label htmlFor={id} className="label">{f.label}</label>
          <textarea rows={3} className={cx("input", error && "input-err")} {...register(f.name)} {...common} />
          {help}{errEl}
        </div>
      );
    case "model":
      return (
        <div>
          <label htmlFor={id} className="label">{f.label}</label>
          <Controller control={control} name={f.name} render={({ field }) => (
            <ModelPicker id={id} value={field.value} types={["bike", "scooter"]} onPick={(m) => field.onChange(m.id)} compact />
          )} />
          {values[f.name] ? <p className="help">Selected: <b>{String(values[f.name])}</b></p> : null}
          {help}{errEl}
        </div>
      );
    case "file":
      return (
        <Controller control={control} name={f.name} render={({ field }) => (
          <UploadField id={id} kind={f.doc_kind!} label={f.label} applicationId={applicationId} value={field.value}
            capture={f.doc_kind === "selfie" ? "user" : undefined}
            onChange={(docId: string | undefined, _d?: Doc) => field.onChange(docId ?? "")} error={error} />
        )} />
      );
    default: {
      const masked = isMasked(values[f.name]);
      const type = f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text";
      const inputMode = ["money", "number", "pincode", "account"].includes(f.type) ? "numeric" : f.type === "tel" ? "tel" : undefined;
      return (
        <div>
          <label htmlFor={id} className="label">{f.label}</label>
          <input type={type} inputMode={inputMode} autoComplete={f.sensitive ? "off" : undefined}
            className={cx("input", error && "input-err", ["pan", "ifsc"].includes(f.type) && "uppercase")}
            placeholder={f.type === "pan" ? "ABCDE1234F" : f.type === "ifsc" ? "ABCD0123456" : undefined}
            {...register(f.name)} {...common}
            onFocus={() => { if (masked) setValue(f.name, ""); }} />
          {masked && <p className="help">Stored securely and masked. Tap to replace.</p>}
          {help}{errEl}
        </div>
      );
    }
  }
}
