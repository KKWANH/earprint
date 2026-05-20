"use client";

import { useState } from "react";

/** 동기화 토큰 표시 + 복사 버튼. */
export function TokenBox({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md bg-neutral-800 px-3 py-2 text-sm">
        {token}
      </code>
      <button
        onClick={copy}
        className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-900"
      >
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}
