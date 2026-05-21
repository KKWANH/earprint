"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ArtistMapData, GhostArtist } from "@/lib/artistMap";

/** Live physics state for one node. */
interface Sim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
}

/** A unified map node — a liked artist, or an unheard "ghost" recommendation. */
interface MapNode {
  name: string;
  count: number; // 0 for ghosts
  genres: [string, number][];
  ghost: boolean;
  related: number[]; // ghost → indices of the library artists it connects to
}

interface Edge {
  a: number;
  b: number;
  sim: number;
  ghost: boolean;
}

function genreHue(g: string): number {
  let h = 0;
  for (let i = 0; i < g.length; i++) h = (h * 31 + g.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, v] of a) {
    na += v * v;
    const w = b.get(k);
    if (w) dot += v * w;
  }
  for (const v of b.values()) nb += v * v;
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

export function ArtistMap({
  data,
  ghosts,
}: {
  data: ArtistMapData;
  ghosts: GhostArtist[];
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  // ── Unified node list: liked artists first, then ghost recommendations ──
  const nodes = useMemo<MapNode[]>(() => {
    const lib: MapNode[] = data.artists.map((a) => ({
      name: a.name,
      count: a.count,
      genres: a.genres,
      ghost: false,
      related: [],
    }));
    const indexByName = new Map(lib.map((n, i) => [n.name, i]));
    const ghostNodes: MapNode[] = ghosts.map((g) => ({
      name: g.name,
      count: 0,
      genres: [],
      ghost: true,
      related: g.related
        .map((r) => indexByName.get(r))
        .filter((i): i is number => i != null),
    }));
    return [...lib, ...ghostNodes];
  }, [data.artists, ghosts]);
  const N = nodes.length;
  const libCount = data.artists.length;

  async function excludeArtist(name: string) {
    setBusy(true);
    try {
      await fetch("/api/exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist: name, action: "exclude" }),
      });
      setSelected(null);
      router.refresh();
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  async function discoverAdd(name: string) {
    setBusy(true);
    try {
      await fetch("/api/discover-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist: name }),
      });
      setSelected(null);
      router.refresh(); // the ghost becomes a real, filled node
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  // ── Edges: genre similarity between liked artists + ghost→library links ──
  const { edges, neighbors } = useMemo(() => {
    const gm = nodes.map((n) => new Map(n.genres));
    const raw: Edge[] = [];
    for (let i = 0; i < libCount; i++) {
      const cand: { b: number; sim: number }[] = [];
      for (let j = 0; j < libCount; j++) {
        if (i === j) continue;
        const s = cosineSim(gm[i], gm[j]);
        if (s > 0.2) cand.push({ b: j, sim: s });
      }
      cand.sort((x, y) => y.sim - x.sim);
      for (const c of cand.slice(0, 5)) {
        raw.push({ a: Math.min(i, c.b), b: Math.max(i, c.b), sim: c.sim, ghost: false });
      }
    }
    const seen = new Set<string>();
    const edges = raw.filter((e) => {
      const k = `${e.a}-${e.b}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    // ghost links
    for (let gi = libCount; gi < N; gi++) {
      for (const li of nodes[gi].related) {
        edges.push({ a: li, b: gi, sim: 0.5, ghost: true });
      }
    }
    const neighbors: Set<number>[] = nodes.map(() => new Set<number>());
    for (const e of edges) {
      neighbors[e.a].add(e.b);
      neighbors[e.b].add(e.a);
    }
    return { edges, neighbors };
  }, [nodes, N, libCount]);

  // ── Physics state ───────────────────────────────────────────────────
  const simRef = useRef<Sim[]>([]);
  if (simRef.current.length !== N) {
    const maxCount = Math.max(1, ...nodes.map((n) => n.count));
    simRef.current = nodes.map((n, i) => {
      const ang = (i / Math.max(1, N)) * Math.PI * 2;
      const rad = n.ghost ? 360 + ((i * 37) % 220) : 150 + ((i * 53) % 220);
      return {
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad,
        vx: 0,
        vy: 0,
        r: n.ghost ? 8 : 7 + 26 * Math.sqrt(n.count / maxCount),
        hue: n.genres[0] ? genreHue(n.genres[0][0]) : 215,
      };
    });
  }

  const cam = useRef({ scale: 1, x: 0, y: 0 });
  const alpha = useRef(1);
  const hover = useRef<number | null>(null);
  const drag = useRef<{
    mode: "node" | "pan" | null;
    idx: number;
    sx: number;
    sy: number;
    moved: boolean;
  }>({ mode: null, idx: -1, sx: 0, sy: 0, moved: false });
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;

  // ── Render + physics loop ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (cam.current.x === 0 && cam.current.y === 0) {
        cam.current.x = w / 2;
        cam.current.y = h / 2;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const sim = simRef.current;

    const step = () => {
      const a = alpha.current;
      if (a > 0.015) {
        for (let i = 0; i < N; i++) {
          const ni = sim[i];
          for (let j = i + 1; j < N; j++) {
            const nj = sim[j];
            let dx = ni.x - nj.x;
            let dy = ni.y - nj.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 1) {
              d2 = 1;
              dx = Math.random() - 0.5;
              dy = Math.random() - 0.5;
            }
            const f = (2400 * a) / d2;
            const d = Math.sqrt(d2);
            ni.vx += (dx / d) * f;
            ni.vy += (dy / d) * f;
            nj.vx -= (dx / d) * f;
            nj.vy -= (dy / d) * f;
          }
        }
        for (const e of edges) {
          const na = sim[e.a];
          const nb = sim[e.b];
          const dx = nb.x - na.x;
          const dy = nb.y - na.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const target = 70 + (1 - e.sim) * 150;
          const f = (d - target) * 0.018 * a;
          na.vx += (dx / d) * f;
          na.vy += (dy / d) * f;
          nb.vx -= (dx / d) * f;
          nb.vy -= (dy / d) * f;
        }
        for (const n of sim) {
          n.vx -= n.x * 0.004 * a;
          n.vy -= n.y * 0.004 * a;
          n.vx *= 0.82;
          n.vy *= 0.82;
          n.x += n.vx;
          n.y += n.vy;
        }
        alpha.current = a * 0.992;
      }

      const { scale, x: ox, y: oy } = cam.current;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, w, h);

      const sel = selectedRef.current;
      const focus = sel ?? hover.current;
      const nbr = focus != null ? neighbors[focus] : null;

      // edges
      for (const e of edges) {
        const lit = focus != null && (e.a === focus || e.b === focus);
        if (e.ghost) {
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.strokeStyle = lit ? "rgba(110,231,183,0.6)" : "rgba(110,231,183,0.13)";
        } else {
          ctx.setLineDash([]);
          ctx.lineWidth = 1;
          ctx.strokeStyle = lit
            ? "rgba(129,140,248,0.55)"
            : focus != null
              ? "rgba(255,255,255,0.04)"
              : `rgba(148,163,184,${0.05 + e.sim * 0.12})`;
        }
        ctx.beginPath();
        ctx.moveTo(sim[e.a].x * scale + ox, sim[e.a].y * scale + oy);
        ctx.lineTo(sim[e.b].x * scale + ox, sim[e.b].y * scale + oy);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // nodes
      for (let i = 0; i < N; i++) {
        const node = nodes[i];
        const s = sim[i];
        const px = s.x * scale + ox;
        const py = s.y * scale + oy;
        const r = s.r * scale;
        const dim = focus != null && i !== focus && !(nbr && nbr.has(i));
        ctx.globalAlpha = dim ? 0.2 : 1;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        if (node.ghost) {
          // unheard recommendation — an empty circle
          ctx.fillStyle = "#101013";
          ctx.fill();
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = i === focus ? "#fff" : "rgba(110,231,183,0.85)";
          ctx.stroke();
        } else {
          ctx.fillStyle = `hsl(${s.hue} 62% 58%)`;
          ctx.fill();
          if (i === focus) {
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "#fff";
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      // labels
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const order = [...Array(N).keys()].sort((a, b) => sim[b].r - sim[a].r);
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      for (const i of order) {
        const node = nodes[i];
        const s = sim[i];
        const isFocus = i === focus;
        const isNbr = nbr ? nbr.has(i) : false;
        if (focus != null && !isFocus && !isNbr) continue;
        // when nothing is focused, keep ghost labels off unless hovered
        if (focus == null && node.ghost) continue;
        const px = s.x * scale + ox;
        const py = s.y * scale + oy;
        if (px < -120 || px > w + 120 || py < -40 || py > h + 40) continue;
        const fs = isFocus ? 14 : 11;
        ctx.font = `${isFocus ? 700 : 500} ${fs}px ui-sans-serif, system-ui, sans-serif`;
        const tw = ctx.measureText(node.name).width;
        const ty = py - s.r * scale - 7;
        const rect = { x: px - tw / 2, y: ty - fs / 2, w: tw, h: fs + 3 };
        if (!isFocus) {
          let hit = false;
          for (const p of placed) {
            if (
              rect.x < p.x + p.w &&
              rect.x + rect.w > p.x &&
              rect.y < p.y + p.h &&
              rect.y + rect.h > p.y
            ) {
              hit = true;
              break;
            }
          }
          if (hit) continue;
        }
        placed.push(rect);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = "rgba(10,10,11,0.95)";
        ctx.strokeText(node.name, px, ty);
        ctx.fillStyle = isFocus
          ? "#fff"
          : node.ghost
            ? "#6ee7b7"
            : isNbr
              ? "#e2e8f0"
              : "#cbd5e1";
        ctx.fillText(node.name, px, ty);
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [N, edges, neighbors, nodes]);

  // ── Pointer interaction ─────────────────────────────────────────────
  function hitTest(sx: number, sy: number): number {
    const { scale, x: ox, y: oy } = cam.current;
    const sim = simRef.current;
    for (let i = N - 1; i >= 0; i--) {
      const px = sim[i].x * scale + ox;
      const py = sim[i].y * scale + oy;
      const r = sim[i].r * scale + 4;
      if ((sx - px) ** 2 + (sy - py) ** 2 <= r * r) return i;
    }
    return -1;
  }

  function localXY(e: React.PointerEvent | React.WheelEvent): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const [sx, sy] = localXY(e);
    const idx = hitTest(sx, sy);
    drag.current = { mode: idx >= 0 ? "node" : "pan", idx, sx, sy, moved: false };
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const [sx, sy] = localXY(e);
    const d = drag.current;
    if (d.mode === null) {
      const idx = hitTest(sx, sy);
      hover.current = idx >= 0 ? idx : null;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = idx >= 0 ? "pointer" : "grab";
      }
      return;
    }
    if (Math.abs(sx - d.sx) + Math.abs(sy - d.sy) > 3) d.moved = true;
    if (d.mode === "pan") {
      cam.current.x += sx - d.sx;
      cam.current.y += sy - d.sy;
      d.sx = sx;
      d.sy = sy;
    } else if (d.mode === "node" && d.idx >= 0) {
      const { scale, x: ox, y: oy } = cam.current;
      const n = simRef.current[d.idx];
      n.x = (sx - ox) / scale;
      n.y = (sy - oy) / scale;
      n.vx = 0;
      n.vy = 0;
      alpha.current = Math.max(alpha.current, 0.5);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d.mode === "node" && d.idx >= 0 && !d.moved) {
      setSelected((s) => (s === d.idx ? null : d.idx));
    } else if (d.mode === "pan" && !d.moved) {
      setSelected(null);
    }
    drag.current = { mode: null, idx: -1, sx: 0, sy: 0, moved: false };
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  const onWheel = (e: React.WheelEvent) => {
    const [sx, sy] = localXY(e);
    const c = cam.current;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const next = Math.min(4, Math.max(0.25, c.scale * factor));
    const wx = (sx - c.x) / c.scale;
    const wy = (sy - c.y) / c.scale;
    c.scale = next;
    c.x = sx - wx * next;
    c.y = sy - wy * next;
  };

  function runSearch(q: string) {
    setQuery(q);
    const t = q.trim().toLowerCase();
    if (!t) return;
    const idx = nodes.findIndex((n) => n.name.toLowerCase().includes(t));
    if (idx < 0) return;
    setSelected(idx);
    const wrap = wrapRef.current;
    const n = simRef.current[idx];
    if (wrap) {
      cam.current.scale = 1.4;
      cam.current.x = wrap.clientWidth / 2 - n.x * 1.4;
      cam.current.y = wrap.clientHeight / 2 - n.y * 1.4;
    }
  }

  const sel = selected != null ? nodes[selected] : null;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          className="touch-none select-none"
          style={{ cursor: "grab" }}
        />
      </div>

      {/* search + legend */}
      <div className="absolute left-3 top-3 flex flex-col gap-2 sm:left-4 sm:top-4">
        <input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="아티스트 검색…"
          className="w-48 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-sm text-white placeholder:text-neutral-500 outline-none backdrop-blur focus:border-emerald-500/60 sm:w-56"
        />
        <div className="rounded-md bg-black/60 px-2 py-1.5 text-[11px] leading-relaxed text-neutral-400 backdrop-blur">
          드래그·휠로 탐색 · 점을 눌러 상세<br />
          <span className="text-emerald-300">◯ 빈 원</span> = 안 들어본 추천 — 눌러서 추가
        </div>
      </div>

      {data.analyzed < data.artists.length * 0.5 && (
        <div className="absolute right-3 top-3 max-w-[13rem] rounded-lg border border-amber-500/30 bg-amber-950/70 px-3 py-2 text-[11px] text-amber-200 backdrop-blur sm:right-4 sm:top-4">
          분석된 곡이 적어 군집이 흐립니다. 곡 분석을 끝내면 또렷해집니다.
        </div>
      )}

      {/* detail panel */}
      {sel && (
        <div className="absolute bottom-3 left-3 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-white/10 bg-black/85 p-4 backdrop-blur sm:bottom-4 sm:left-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold leading-tight text-white">{sel.name}</h3>
            <button
              onClick={() => setSelected(null)}
              className="shrink-0 text-neutral-500 hover:text-white"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          {sel.ghost ? (
            <>
              <p className="mt-0.5 text-sm text-emerald-300">
                안 들어본 연관 아티스트
              </p>
              {selected != null && neighbors[selected].size > 0 && (
                <p className="mt-2 text-xs text-neutral-400">
                  당신의{" "}
                  <span className="text-neutral-200">
                    {[...neighbors[selected]]
                      .slice(0, 5)
                      .map((i) => nodes[i].name)
                      .join(" · ")}
                  </span>{" "}
                  취향과 가깝습니다.
                </p>
              )}
              <button
                onClick={() => discoverAdd(sel.name)}
                disabled={busy}
                className="mt-3 w-full rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
              >
                {busy ? "추가하는 중…" : "♥ 라이브러리에 추가"}
              </button>
              <p className="mt-1.5 text-[11px] text-neutral-600">
                대표곡이 라이브러리에 추가되고 맵이 다시 정렬됩니다.
              </p>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-sm text-neutral-400">
                좋아요 {sel.count.toLocaleString()}곡
              </p>
              {sel.genres.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sel.genres.map(([g]) => (
                    <span
                      key={g}
                      className="rounded-full px-2 py-0.5 text-xs text-white"
                      style={{ background: `hsl(${genreHue(g)} 50% 32%)` }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-neutral-600">아직 장르 분석 전</p>
              )}
              {selected != null && neighbors[selected].size > 0 && (
                <div className="mt-3 border-t border-white/10 pt-2">
                  <p className="text-[11px] text-neutral-500">취향이 가까운 아티스트</p>
                  <p className="mt-1 text-xs text-neutral-300">
                    {[...neighbors[selected]]
                      .slice(0, 6)
                      .map((i) => nodes[i].name)
                      .join(" · ")}
                  </p>
                </div>
              )}
              <button
                onClick={() => excludeArtist(sel.name)}
                disabled={busy}
                className="mt-3 w-full rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/5 hover:text-rose-300 disabled:opacity-40"
              >
                {busy ? "처리 중…" : "맵·분석에서 이 아티스트 제외 (유튜버 등)"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
