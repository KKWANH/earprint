"use client";

import { useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { securityDict, type ReportCategory } from "@/lib/i18n/security";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Categories that *need* an email to be useful (we can't action a refund
 *  without one). Security stays anonymous-friendly because researchers
 *  sometimes want it that way. */
const EMAIL_REQUIRED: Set<ReportCategory> = new Set([
  "billing",
  "account",
]);

const CATEGORY_ORDER: ReportCategory[] = [
  "general",
  "billing",
  "account",
  "bug",
  "security",
];

export function ReportForm({ locale }: { locale: Locale }) {
  const t = securityDict(locale);
  const [category, setCategory] = useState<ReportCategory>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<{
    name: string;
    mime: string;
    base64: string;
    preview: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{
    text: string;
    kind: "success" | "error";
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const emailRequired = EMAIL_REQUIRED.has(category);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) {
      setMsg({ text: `${t.errorPrefix} ${t.fieldImage}`, kind: "error" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.split(",")[1] ?? "";
      setImage({
        name: f.name,
        mime: f.type || "image/png",
        base64,
        preview: dataUrl,
      });
    };
    reader.readAsDataURL(f);
  }

  function removeImage() {
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/security/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title,
          body,
          email: email || undefined,
          imageBase64: image?.base64,
          imageMime: image?.mime,
          imageName: image?.name,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMsg({
          text: `${t.errorPrefix} ${data.error ?? res.statusText}`,
          kind: "error",
        });
      } else {
        setMsg({ text: t.successMsg, kind: "success" });
        setTitle("");
        setBody("");
        setEmail("");
        removeImage();
        setCategory("general");
      }
    } catch (err) {
      setMsg({ text: `${t.errorPrefix} ${String(err)}`, kind: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wider text-neutral-500">
          {t.fieldCategory} <span className="text-rose-400">*</span>
        </span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ReportCategory)}
          className="cursor-pointer rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
        >
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {t.categories[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wider text-neutral-500">
          {t.fieldTitle} <span className="text-rose-400">*</span>
        </span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.fieldTitlePlaceholder}
          maxLength={200}
          className="rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wider text-neutral-500">
          {t.fieldBody} <span className="text-rose-400">*</span>
        </span>
        <textarea
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.fieldBodyPlaceholder}
          maxLength={8000}
          rows={8}
          className="resize-y rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wider text-neutral-500">
          {t.fieldEmail}{" "}
          {emailRequired && <span className="text-rose-400">*</span>}
        </span>
        <input
          type="email"
          required={emailRequired}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.fieldEmailPlaceholder}
          maxLength={200}
          className="rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
        />
        <span className="text-[11px] text-neutral-600">
          {emailRequired ? t.emailHintRequired : t.emailHintOptional}
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider text-neutral-500">
          {t.fieldImage}
        </span>
        {image ? (
          <div className="flex items-start gap-3 rounded-md border border-white/10 bg-neutral-900 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.preview}
              alt=""
              className="h-20 w-20 rounded object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-xs text-neutral-300">{image.name}</span>
              <button
                type="button"
                onClick={removeImage}
                className="self-start text-xs text-rose-300 hover:text-rose-200"
              >
                {t.imageRemove}
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onFile}
              className="block w-full cursor-pointer rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-neutral-200"
            />
            <span className="text-[11px] text-neutral-600">{t.imageHelp}</span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={
            pending || !title || !body || (emailRequired && !email)
          }
          className="self-start rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t.submitting : t.submit}
        </button>
        {msg && (
          <p
            className={`text-sm ${
              msg.kind === "success" ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
