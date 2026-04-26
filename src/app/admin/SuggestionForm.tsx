"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SLOTS = [
  { value: "custom", label: "Custom prompt" },
  { value: "on-this-day", label: "On this day" },
  { value: "recent-match", label: "Recent match" },
  { value: "transfer", label: "Transfer story" },
  { value: "tactics", label: "Tactical theme" },
  { value: "player", label: "Player profile" },
];

export function SuggestionForm() {
  const router = useRouter();
  const [slot, setSlot] = useState("custom");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const r = await fetch("/api/generate-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, prompt }),
    });
    setBusy(false);
    if (r.ok) {
      setPrompt("");
      setMsg(
        "Queued. Run `npm run process:queue` (or have it running with --watch) on your laptop to generate the draft.",
      );
      router.refresh();
    } else {
      const data = await r.json().catch(() => ({}));
      setErr(data.error || "Request failed.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SLOTS.map((s) => (
          <button
            type="button"
            key={s.value}
            onClick={() => setSlot(s.value)}
            className={`text-[11px] uppercase tracking-widest px-2.5 py-1.5 rounded font-bold border transition-colors ${
              slot === s.value
                ? "bg-accent text-bg border-accent"
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
            ? "e.g. 'Tactical analysis of De Zerbi's high-line at Marseille this season'"
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
