"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ArtistMapData, GhostArtist } from "@/lib/artistMap";
import { genreHue, stepPhysics, type Sim } from "@/lib/forceGraph";
import type { Locale } from "@/lib/i18n";
import { mapDict } from "@/lib/i18n/map";

/** A unified map node — a liked artist, or an unheard "ghost" recommendation. */
interface MapNode {
  name: string;
  count: number; // 0 for ghosts
  affinity: number; // 1 normal · 2 like · 3 favorite
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
  locale,
}: {
  data: ArtistMapData;
  ghosts: GhostArtist[];
  locale: Locale;
}) {
  const t = mapDict(locale);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [showGhosts, setShowGhosts] = useState(true);
  const showGhostsRef = useRef(true);
  showGhostsRef.current = showGhosts;

  // ── Unified node list: liked artists first, then ghost recommendations ──
  const nodes = useMemo<MapNode[]>(() => {
    const lib: MapNode[] = data.artists.map((a) => ({
      name: a.name,
      count: a.count,
      affinity: a.affinity,
      genres: a.genres,
      ghost: false,
      related: [],
    }));
    const indexByName = new Map(lib.map((n, i) => [n.name, i]));
    const ghostNodes: MapNode[] = ghosts.map((g) => ({
      name: g.name,
      count: 0,
      affinity: 1,
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

  async function discoverAdd(name: string, weight: number) {
    setBusy(true);
    try {
      await fetch("/api/discover-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist: name, weight }),
      });
      setSelected(null);
      router.refresh(); // the ghost becomes a real, filled node
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  async function rateAffinity(name: string, weight: number) {
    setBusy(true);
    try {
      await fetch("/api/affinity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist: name, weight }),
      });
      router.refresh(); // node resizes to reflect the new weight
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
    // Node size reflects liked-track count *and* how much the user likes the
    // artist (affinity) — favourites loom larger.
    const maxEff = Math.max(1, ...nodes.map((n) => n.count * n.affinity));
    simRef.current = nodes.map((n, i) => {
      const ang = (i / Math.max(1, N)) * Math.PI * 2;
      const rad = n.ghost ? 360 + ((i * 37) % 220) : 150 + ((i * 53) % 220);
      return {
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad,
        vx: 0,
        vy: 0,
        r: n.ghost ? 8 : 7 + 28 * Math.sqrt((n.count * n.affinity) / maxEff),
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
    const physEdges = edges.map((e) => ({
      a: e.a,
      b: e.b,
      target: 70 + (1 - e.sim) * 150,
    }));

    const step = () => {
      const a = alpha.current;
      if (a > 0.015) {
        stepPhysics(sim, physEdges, a, {
          repulsion: 2400,
          springK: 0.018,
          gravity: 0.004,
          damping: 0.82,
        });
        alpha.current = a * 0.992;
      }

      const { scale, x: ox, y: oy } = cam.current;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, w, h);

      const sel = selectedRef.current;
      const focus = sel ?? hover.current;
      const nbr = focus != null ? neighbors[focus] : null;

      const ghostsOn = showGhostsRef.current;

      // edges
      for (const e of edges) {
        if (e.ghost && !ghostsOn) continue;
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
        if (node.ghost && !ghostsOn) continue;
        const s = sim[i];
        const px = s.x * scale + ox;
        const py = s.y * scale + oy;
        const r = s.r * scale;
        const dim = focus != null && i !== focus && !(nbr && nbr.has(i));
        ctx.globalAlpha = dim ? 0.2 : 1;
        // soft glow on the focused node
        if (i === focus) {
          ctx.shadowBlur = 22;
          ctx.shadowColor = node.ghost ? "rgba(110,231,183,0.9)" : `hsl(${s.hue} 80% 65%)`;
        }
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        if (node.ghost) {
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
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // labels
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const order = [...Array(N).keys()].sort((a, b) => sim[b].r - sim[a].r);
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      for (const i of order) {
        const node = nodes[i];
        if (node.ghost && !ghostsOn) continue;
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

  // ── Camera helpers ──────────────────────────────────────────────────
  function zoomBy(factor: number) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const c = cam.current;
    const cx = wrap.clientWidth / 2;
    const cy = wrap.clientHeight / 2;
    const next = Math.min(4, Math.max(0.25, c.scale * factor));
    c.x = cx - ((cx - c.x) / c.scale) * next;
    c.y = cy - ((cy - c.y) / c.scale) * next;
    c.scale = next;
  }

  /** Frames every (visible) node to fit the viewport. */
  function fitView() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const sim = simRef.current;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      if (nodes[i].ghost && !showGhostsRef.current) continue;
      const s = sim[i];
      minX = Math.min(minX, s.x - s.r);
      minY = Math.min(minY, s.y - s.r);
      maxX = Math.max(maxX, s.x + s.r);
      maxY = Math.max(maxY, s.y + s.r);
    }
    if (!Number.isFinite(minX)) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const scale = Math.min(4, Math.max(0.25, 0.86 * Math.min(w / (maxX - minX), h / (maxY - minY))));
    cam.current.scale = scale;
    cam.current.x = w / 2 - ((minX + maxX) / 2) * scale;
    cam.current.y = h / 2 - ((minY + maxY) / 2) * scale;
  }

  // ── Pointer interaction ─────────────────────────────────────────────
  function hitTest(sx: number, sy: number): number {
    const { scale, x: ox, y: oy } = cam.current;
    const sim = simRef.current;
    for (let i = N - 1; i >= 0; i--) {
      if (nodes[i].ghost && !showGhostsRef.current) continue;
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
          placeholder={t.searchPlaceholder}
          className="w-48 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-sm text-white placeholder:text-neutral-500 outline-none backdrop-blur focus:border-emerald-500/60 sm:w-56"
        />
        <div className="rounded-md bg-black/60 px-2 py-1.5 text-[11px] leading-relaxed text-neutral-400 backdrop-blur">
          {t.legendLine1}<br />
          <span className="text-emerald-300">{t.legendEmptyCircle}</span>{t.legendEmptyCircleRest}
        </div>
      </div>

      {data.analyzed < data.artists.length * 0.5 && (
        <div className="absolute right-3 top-3 max-w-[13rem] rounded-lg border border-amber-500/30 bg-amber-950/70 px-3 py-2 text-[11px] text-amber-200 backdrop-blur sm:right-4 sm:top-4">
          {t.fewAnalyzedWarning}
        </div>
      )}

      {/* zoom + view controls */}
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2 sm:bottom-4 sm:right-4">
        <button
          onClick={() => setShowGhosts((g) => !g)}
          className="rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-neutral-300 backdrop-blur hover:bg-white/10"
        >
          {showGhosts ? t.hideRecommendations : t.showRecommendations}
        </button>
        <div className="flex flex-col overflow-hidden rounded-lg border border-white/10 bg-black/70 backdrop-blur">
          <button
            onClick={() => zoomBy(1.3)}
            aria-label={t.zoomIn}
            className="h-9 w-9 text-lg text-neutral-300 hover:bg-white/10"
          >
            ＋
          </button>
          <button
            onClick={() => zoomBy(1 / 1.3)}
            aria-label={t.zoomOut}
            className="h-9 w-9 border-t border-white/10 text-lg text-neutral-300 hover:bg-white/10"
          >
            －
          </button>
          <button
            onClick={fitView}
            aria-label={t.fitView}
            title={t.fitView}
            className="h-9 w-9 border-t border-white/10 text-sm text-neutral-300 hover:bg-white/10"
          >
            ⊡
          </button>
        </div>
      </div>

      {/* detail panel */}
      {sel && (
        <div className="absolute bottom-3 left-3 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-white/10 bg-black/85 p-4 backdrop-blur sm:bottom-4 sm:left-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold leading-tight text-white">{sel.name}</h3>
            <button
              onClick={() => setSelected(null)}
              className="shrink-0 text-neutral-500 hover:text-white"
              aria-label={t.close}
            >
              ✕
            </button>
          </div>

          <Link
            href={`/artist/${encodeURIComponent(sel.name)}`}
            className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            {t.viewDetail}
          </Link>

          {sel.ghost ? (
            <>
              <p className="mt-0.5 text-sm text-emerald-300">
                {t.ghostSubtitle}
              </p>
              {selected != null && neighbors[selected].size > 0 && (
                <p className="mt-2 text-xs text-neutral-400">
                  {t.ghostCloseToPre}
                  <span className="text-neutral-200">
                    {[...neighbors[selected]]
                      .slice(0, 5)
                      .map((i) => nodes[i].name)
                      .join(" · ")}
                  </span>
                  {t.ghostCloseToPost}
                </p>
              )}
              <p className="mt-3 text-[11px] text-neutral-500">
                {t.addToLibraryPrompt}
              </p>
              <div className="mt-1.5 flex gap-1.5">
                {[
                  { w: 1, label: t.rateHeard },
                  { w: 2, label: t.rateLike },
                  { w: 3, label: t.rateFavorite },
                ].map((o) => (
                  <button
                    key={o.w}
                    onClick={() => discoverAdd(sel.name, o.w)}
                    disabled={busy}
                    className="flex-1 rounded-md bg-emerald-500/90 px-2 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-600">
                {busy ? t.processing : t.ghostAddNote}
              </p>
              <button
                onClick={() => excludeArtist(sel.name)}
                disabled={busy}
                className="mt-2 w-full rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/5 hover:text-rose-300 disabled:opacity-40"
              >
                {t.dislikeButton}
              </button>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-sm text-neutral-400">
                {t.likedCount(sel.count.toLocaleString())}
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
                <p className="mt-3 text-xs text-neutral-600">{t.noGenresYet}</p>
              )}
              {selected != null && neighbors[selected].size > 0 && (
                <div className="mt-3 border-t border-white/10 pt-2">
                  <p className="text-[11px] text-neutral-500">{t.closeTasteArtists}</p>
                  <p className="mt-1 text-xs text-neutral-300">
                    {[...neighbors[selected]]
                      .slice(0, 6)
                      .map((i) => nodes[i].name)
                      .join(" · ")}
                  </p>
                </div>
              )}
              <div className="mt-3 border-t border-white/10 pt-3">
                <p className="text-[11px] text-neutral-500">
                  {t.affinityPrompt}
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  {[
                    { w: 1, label: t.affinityNormal },
                    { w: 2, label: t.affinityLike },
                    { w: 3, label: t.affinityFavorite },
                  ].map((o) => {
                    const active = Math.round(sel.affinity) === o.w;
                    return (
                      <button
                        key={o.w}
                        onClick={() => rateAffinity(sel.name, o.w)}
                        disabled={busy}
                        className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                          active
                            ? "bg-amber-500/30 font-semibold text-amber-200 ring-1 ring-amber-500/50"
                            : "bg-white/5 text-neutral-400 hover:bg-white/10"
                        }`}
                      >
                        {"★".repeat(o.w)} {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => excludeArtist(sel.name)}
                disabled={busy}
                className="mt-3 w-full rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/5 hover:text-rose-300 disabled:opacity-40"
              >
                {busy ? t.excludeBusy : t.excludeButton}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
