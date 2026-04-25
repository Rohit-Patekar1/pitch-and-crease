"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (r.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("Wrong password.");
    }
  }

  return (
    <div className="max-w-sm mx-auto px-5 pt-24">
      <h1 className="text-2xl font-bold mb-6">Admin login</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
          placeholder="Password"
          className="w-full bg-panel border border-line rounded-lg px-4 py-2.5 outline-none focus:border-accent"
        />
        {error && <p className="text-football text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy || !pw}
          className="w-full bg-accent text-bg font-bold py-2.5 rounded-lg disabled:opacity-50"
        >
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
