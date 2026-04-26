"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ARTICLE_SLOTS = [
  { value: "custom", label: "Custom" },
  { value: "on-this-day", label: "On this day" },
  { value: "recent-match", label: "Recent match" },
  { value: "transfer", label: "Transfer" },
  { value: "tactics", label: "Tactics" },
  { value: "player", label: "Player" },
];

const SOCIAL_SLOTS = [
  { value: "custom", label: "Custom" },
  { value: "on-this-day", label: "On this day" },
  { value: "stat-moment", label: "Stat moment" },
  { value: "quick-take", label: "Quick take" },
  { value: "transfer-flash", label: "Transfer flash" },
];

export function SuggestionForm() {
  const router = useRouter();
  const [contentType, setContentType] = useState<"ARTICLE" | "SOCIAL">("ARTICLE");
  const [slot, setSlot] = useState("custom");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const slots = contentType === "ARTICLE" ? ARTICLE_SLOTS : SOCIAL_SLOTS;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const r = await fetch("/api/generate-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType, slot, prompt }),
    });
    setBusy(false);
    if (r.ok) {
      setPrompt("");
      setMsg(
        `Queued. Run \`npm run process:queue\` on your laptop to generate the ${contentType === "ARTICLE" ? "article" : "social post"}.`,
      );
      router.refresh();
    } else {
      const data = await r.json().catch(() => ({}));
      setErr(data.error || "Request failed.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Content type selector */}
      <div className="flex gap-2 mb-1">
        {(["ARTICLE", "SOCIAL"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => {
              setContentType(t);
              setSlot("custom");
            }}
            className={`text-xs uppercase tracking-widest px-3 py-1.5 rounded font-bold border transition-colors ${
              contentType === t
                ? "bg-accent text-bg border-accent"
                : "border-line text-ink-dim hover:text-ink"
            }`}
          >
            {t === "ARTICLE" ? "Long-form article" : "Twitter-native post"}
          </button>
        ))}
      </div>
      {/* Slot pills */}
      <div className="flex flex-wrap gap-2">
        {slots.map((s) => (
          <button
            type="button"
            key={s.value}
            onClick={() => setSlot(s.value)}
            className={`text-[11px] uppercase tracking-widest px-2.5 py-1.5 rounded font-bold border transition-colors ${
              slot === s.value
                ? "bg-panel-2 text-ink border-ink-dim"
                : "border-line text-ink-dim hover:text-ink hover:border-ink-dim"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          slot === "custom"
            ? contentType === "ARTICLE"
              ? "e.g. 'Tactical analysis of De Zerbi's high-line at Marseille this season'"
              : "e.g. 'On this day: Henry's Highbury vs Madrid free kick'"
            : "(optional refinement — leave blank for default behavior)"
        }
        className="w-full bg-panel-2 border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || (slot === "custom" && !prompt.trim())}
          className="bg-accent text-bg font-bold px-4 py-2 rounded-lg disabled:opacity-50 text-sm"
        >
          {busy ? "Queueing…" : "Queue for generation"}
        </button>
        {msg && <span className="text-xs text-ink-dim">{msg}</span>}
        {err && <span className="text-xs text-football">{err}</span>}
      </div>
    </form>
  );
}
