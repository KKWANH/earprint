"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { genresIndexDict } from "@/lib/i18n/genresIndex";

type Kind = "catalog" | "reanalysis";

/**
 * Two-branch genre feedback form at the bottom of /genres. Kept
 * collapsed by default — the page's headline use case is browsing the
 * frequency bars, not filing tickets, so the form shouldn't compete
 * for attention. Opens on click into an inline panel with the radio
 * picker + single text input + optional note, and dispatches to
 * /api/genre/request which rate-limits at 3/day per user.
 */
export function RequestForm({ locale }: { locale: Locale }) {
  const t = genresIndexDict(locale);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("catalog");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !subject.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/genre/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          subject: subject.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (res.status === 429) {
        setError(t.requestRateLimited);
        setBusy(false);
        return;
      }
      if (!res.ok || !d.ok) {
        setError(d.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setDone(true);
      setSubject("");
      setNote("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-sm"
      >
        <span className="font-semibold">{t.requestTitle}</span>
        <span className="text-neutral-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <p className="text-xs text-neutral-400">{t.requestIntro}</p>

          {/* Branch picker — two cards with the radio embedded in the
              clickable area so the whole row is the hit target. */}
          <div className="flex flex-col gap-2">
            {(
              [
                {
                  id: "catalog" as Kind,
                  label: t.requestKindCatalog,
                  hint: t.requestKindCatalogHint,
                },
                {
                  id: "reanalysis" as Kind,
                  label: t.requestKindReanalysis,
                  hint: t.requestKindReanalysisHint,
                },
              ]
            ).map((opt) => {
              const active = kind === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
                    active
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : "border-neutral-800 bg-black/30 hover:border-emerald-500/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={opt.id}
                    checked={active}
                    onChange={() => setKind(opt.id)}
                    className="mt-1 accent-emerald-500"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-[11px] text-neutral-500">{opt.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {kind === "catalog"
                ? t.requestSubjectCatalog
                : t.requestSubjectReanalysis}
            </label>
            <input
              type="text"
              maxLength={80}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={
                kind === "catalog" ? "vaporwave" : "Mariya Takeuchi"
              }
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {t.requestNote}
            </label>
            <textarea
              maxLength={500}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-md border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}
          {done && (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
              {t.requestSent}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !subject.trim()}
            className="self-start rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.requestSubmit}
          </button>
        </form>
      )}
    </section>
  );
}
