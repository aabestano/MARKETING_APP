"use client";

import { useState } from "react";
import { Eye, EyeOff, Image as ImageIcon, KeyRound } from "lucide-react";
import { DEFAULT_FLUX_MODEL, FLUX_MODELS } from "@/lib/flux";
import { Modal } from "./ui";
import { WorkspaceBackup } from "./WorkspaceBackup";
import { useStore } from "@/lib/store";
import { DEFAULT_IMAGE_MODEL, GEMINI_MODELS, type MailerProvider, type Settings } from "@/lib/types";
import type { ServerStatus } from "./AppShell";

const PROVIDERS: { id: MailerProvider; label: string; note: string }[] = [
  { id: "resend", label: "Resend", note: "Uses the official resend SDK" },
  { id: "sendgrid", label: "SendGrid", note: "v3 Mail Send API" },
  { id: "mandrill", label: "Mailchimp Mandrill", note: "Transactional API" },
];

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className="input pr-9 font-mono"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide key" : "Show key"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function SettingsModal({ status, onClose }: { status: ServerStatus | null; onClose: () => void }) {
  const saved = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [draft, setDraft] = useState<Settings>(saved);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const knownModel = GEMINI_MODELS.some((m) => m.id === draft.geminiModel);

  return (
    <Modal
      title="API & Mail Settings"
      description="Keys are stored in this browser and sent only to this app's own server routes."
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              update(draft);
              onClose();
            }}
          >
            Save settings
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <KeyRound className="h-4 w-4 text-blue-400" /> Gemini
          </h3>
          <div>
            <label className="label">API key</label>
            <SecretInput value={draft.geminiApiKey} onChange={(v) => set("geminiApiKey", v)} placeholder={status?.gemini ? "Using GEMINI_API_KEY from server env" : "AIza..."} />
            <p className="mt-1 text-xs text-slate-500">
              {status?.gemini ? "A server-side key is configured; leave blank to use it." : "Without a key the app falls back to an offline template builder."}
            </p>
          </div>
          <div>
            <label className="label">Model</label>
            <select
              className="input"
              value={knownModel ? draft.geminiModel : "custom"}
              onChange={(e) => set("geminiModel", e.target.value === "custom" ? "" : e.target.value)}
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.id})
                </option>
              ))}
              <option value="custom">Custom model id…</option>
            </select>
            {!knownModel && (
              <input className="input mt-2 font-mono" placeholder="e.g. gemini-3-flash-preview" value={draft.geminiModel} onChange={(e) => set("geminiModel", e.target.value)} />
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <ImageIcon className="h-4 w-4 text-fuchsia-400" /> Poster illustrations
          </h3>
          <p className="text-xs text-slate-500">Choose what draws a picture when none in your library fits. Layouts, ideas and emails always use Gemini.</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["gemini", "Gemini", "Uses the Gemini key above"],
              ["flux", "FLUX (fal.ai)", "Separate fal.ai key, often cheaper"],
            ] as const).map(([id, label, note]) => (
              <button
                key={id}
                onClick={() => set("imageProvider", id)}
                className={`rounded-md border p-2.5 text-left transition ${
                  (draft.imageProvider ?? "gemini") === id ? "border-fuchsia-500/60 bg-fuchsia-500/10" : "border-slate-800 bg-slate-900 hover:border-slate-700"
                }`}
              >
                <div className="text-sm font-medium text-slate-100">{label}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{note}</div>
              </button>
            ))}
          </div>
          {draft.imageProvider === "flux" ? (
            <>
              <div>
                <label className="label">fal.ai API key</label>
                <SecretInput value={draft.fluxApiKey ?? ""} onChange={(v) => set("fluxApiKey", v)} placeholder={status?.flux ? "Using FAL_KEY from server env" : "Paste your fal.ai key"} />
                <p className="mt-1 text-xs text-slate-500">Create one at fal.ai (Dashboard, Keys). Stored in this browser only and left out of workspace exports.</p>
              </div>
              <div>
                <label className="label">FLUX model</label>
                <select
                  className="input"
                  value={FLUX_MODELS.some((m) => m.id === (draft.fluxModel || DEFAULT_FLUX_MODEL)) ? draft.fluxModel || DEFAULT_FLUX_MODEL : "custom"}
                  onChange={(e) => set("fluxModel", e.target.value === "custom" ? "fal-ai/" : e.target.value)}
                >
                  {FLUX_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                  <option value="custom">Other fal.ai model…</option>
                </select>
                {!FLUX_MODELS.some((m) => m.id === (draft.fluxModel || DEFAULT_FLUX_MODEL)) && (
                  <input className="input mt-2 font-mono" placeholder="e.g. fal-ai/flux-pro/v1.1-ultra" value={draft.fluxModel ?? ""} onChange={(e) => set("fluxModel", e.target.value)} />
                )}
              </div>
            </>
          ) : (
            <div>
              <label className="label">Gemini image model</label>
              <input className="input font-mono" value={draft.imageModel ?? ""} onChange={(e) => set("imageModel", e.target.value)} placeholder={DEFAULT_IMAGE_MODEL} />
              <p className="mt-1 text-xs text-slate-500">Image generation may require a paid Gemini plan.</p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Mailer for test sends</h3>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => set("mailerProvider", p.id)}
                className={`rounded-md border p-2.5 text-left transition ${
                  draft.mailerProvider === p.id ? "border-emerald-500/60 bg-emerald-500/10" : "border-slate-800 bg-slate-900 hover:border-slate-700"
                }`}
              >
                <div className="text-sm font-medium text-slate-100">{p.label}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{p.note}</div>
              </button>
            ))}
          </div>
          <div>
            <label className="label">{PROVIDERS.find((p) => p.id === draft.mailerProvider)?.label} API key</label>
            <SecretInput
              value={draft.mailerApiKey}
              onChange={(v) => set("mailerApiKey", v)}
              placeholder={status?.mailers[draft.mailerProvider] ? "Using key from server env" : "Paste API key"}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From name</label>
              <input className="input" value={draft.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="Brand Team" />
            </div>
            <div>
              <label className="label">From email</label>
              <input className="input" type="email" value={draft.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} placeholder="hello@yourdomain.com" />
            </div>
          </div>
          <div>
            <label className="label">Default test recipient</label>
            <input className="input" type="email" value={draft.testRecipient} onChange={(e) => set("testRecipient", e.target.value)} placeholder="you@company.com" />
          </div>
        </section>

        <WorkspaceBackup />
      </div>
    </Modal>
  );
}
