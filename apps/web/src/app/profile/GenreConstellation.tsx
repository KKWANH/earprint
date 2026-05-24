"use client";

import { useEffect, useRef, useState } from "react";
import { genreHue, stepPhysics, type Sim } from "@/lib/forceGraph";
import type { GenreMapData } from "@/lib/genreMap";
import type { Locale } from "@/lib/i18n";
import { profileDict } from "@/lib/i18n/profile";

/**
 * Interactive taste constellation — genres as stars, linked when they
 * co-occur on the same tracks. Drag / wheel to explore, tap a star to light
 * up the genres it blends with.
 */
export function GenreConstellation({
  data,
  locale,
}: {
  data: GenreMapData;
  locale: Locale;
}) {
  const t = profileDict(locale);
  const { nodes, edges } = data;
  const N = nodes.length;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const neighbors = useRef<Set<number>[]>([]);
  if (neighbors.current.length !== N) {
    neighbors.current = nodes.map(() => new Set<number>());
    for (const e of edges) {
      neighbors.current[e.a]?.add(e.b);
      neighbors.current[e.b]?.add(e.a);
    }
  }

  const simRef = useRef<Sim[]>([]);
  if (simRef.current.length !== N) {
    const maxCount = Math.max(1, ...nodes.map((n) => n.count));
    simRef.current = nodes.map((n, i) => {
      const ang = (i / Math.max(1, N)) * Math.PI * 2;
      const rad = 90 + ((i * 47) % 160);
      return {
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad,
        vx: 0,
        vy: 0,
        r: 6 + 22 * Math.sqrt(n.count / maxCount),
        hue: genreHue(n.name),
      };
    });
  }

  const cam = useRef({ scale: 1, x: 0, y: 0 });
  const alpha = useRef(1);
  const hover = useRef<number | null>(null);
  const selRef = useRef<number | null>(null);
  selRef.current = selected;
  const drag = useRef<{ mode: "node" | "pan" | null; idx: number; sx: number; sy: number; moved: boolean }>(
    { mode: null, idx: -1, sx: 0, sy: 0, moved: false },
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let w = 0;
    let h = 0;
    let visible = true;
    let docVisible = !document.hidden;
    const maxW = Math.max(1, ...edges.map((e) => e.weight));
    const physEdges = edges.map((e) => ({
      a: e.a,
      b: e.b,
      target: 150 - (e.weight / maxW) * 86,
    }));

    // Reallocating the canvas backing store on every reported size fires GPU
    // memory pressure under mobile Chrome (URL bar collapse triggers a storm
    // of ResizeObserver events). Bail out when the size hasn't changed.
    const resize = () => {
      const newW = wrap.clientWidth;
      const newH = wrap.clientHeight;
      if (newW === w && newH === h) return;
      const dpr = window.devicePixelRatio || 1;
      w = newW;
      h = newH;
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
        stepPhysics(sim, physEdges, a, {
          repulsion: 1800,
          springK: 0.02,
          gravity: 0.005,
          damping: 0.82,
        });
        alpha.current = a * 0.99;
      }

      const { scale, x: ox, y: oy } = cam.current;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, w, h);
      const focus = selRef.current ?? hover.current;
      const nbr = focus != null ? neighbors.current[focus] : null;

      for (const e of edges) {
        const lit = focus != null && (e.a === focus || e.b === focus);
        ctx.lineWidth = lit ? 1.6 : 1;
        ctx.strokeStyle = lit
          ? "rgba(199,210,254,0.6)"
          : focus != null
            ? "rgba(255,255,255,0.04)"
            : `rgba(148,163,184,${0.05 + (e.weight / maxW) * 0.16})`;
        ctx.beginPath();
        ctx.moveTo(sim[e.a]!.x * scale + ox, sim[e.a]!.y * scale + oy);
        ctx.lineTo(sim[e.b]!.x * scale + ox, sim[e.b]!.y * scale + oy);
        ctx.stroke();
      }

      for (let i = 0; i < N; i++) {
        const s = sim[i]!;
        const px = s.x * scale + ox;
        const py = s.y * scale + oy;
        const dim = focus != null && i !== focus && !(nbr && nbr.has(i));
        ctx.globalAlpha = dim ? 0.22 : 1;
        ctx.beginPath();
        ctx.arc(px, py, s.r * scale, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${s.hue} 62% 60%)`;
        ctx.fill();
        if (i === focus) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#fff";
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const order = [...Array(N).keys()].sort((x, y) => sim[y]!.r - sim[x]!.r);
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      for (const i of order) {
        const s = sim[i]!;
        const isFocus = i === focus;
        const isNbr = nbr ? nbr.has(i) : false;
        if (focus != null && !isFocus && !isNbr) continue;
        const px = s.x * scale + ox;
        const py = s.y * scale + oy;
        if (px < -100 || px > w + 100 || py < -30 || py > h + 30) continue;
        const fs = isFocus ? 13 : 10.5;
        ctx.font = `${isFocus ? 700 : 500} ${fs}px ui-sans-serif, system-ui, sans-serif`;
        const label = nodes[i]!.name;
        const tw = ctx.measureText(label).width;
        const ty = py - s.r * scale - 6;
        const rect = { x: px - tw / 2, y: ty - fs / 2, w: tw, h: fs + 2 };
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
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(10,10,11,0.95)";
        ctx.strokeText(label, px, ty);
        ctx.fillStyle = isFocus ? "#fff" : isNbr ? "#e2e8f0" : "#cbd5e1";
        ctx.fillText(label, px, ty);
      }

      raf = requestAnimationFrame(step);
    };
    const start = () => {
      if (raf) return;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };
    // Pause animation when the canvas scrolls off-screen or the tab loses
    // focus. Without this the RAF runs forever and renderer memory creeps up
    // until Chrome kills the tab (the "Aw, Snap!" page).
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && docVisible) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(wrap);
    const onVis = () => {
      docVisible = !document.hidden;
      if (visible && docVisible) start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [N, edges, nodes]);

  function localXY(e: React.PointerEvent | React.WheelEvent): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }
  function hitTest(sx: number, sy: number): number {
    const { scale, x: ox, y: oy } = cam.current;
    const sim = simRef.current;
    for (let i = N - 1; i >= 0; i--) {
      const px = sim[i]!.x * scale + ox;
      const py = sim[i]!.y * scale + oy;
      const r = sim[i]!.r * scale + 4;
      if ((sx - px) ** 2 + (sy - py) ** 2 <= r * r) return i;
    }
    return -1;
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
      if (canvasRef.current) canvasRef.current.style.cursor = idx >= 0 ? "pointer" : "grab";
      return;
    }
    if (Math.abs(sx - d.sx) + Math.abs(sy - d.sy) > 3) d.moved = true;
    if (d.mode === "pan") {
      cam.current.x += sx - d.sx;
      cam.current.y += sy - d.sy;
      d.sx = sx;
      d.sy = sy;
    } else if (d.idx >= 0) {
      const { scale, x: ox, y: oy } = cam.current;
      const n = simRef.current[d.idx]!;
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
    const next = Math.min(4, Math.max(0.3, c.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    c.x = sx - ((sx - c.x) / c.scale) * next;
    c.y = sy - ((sy - c.y) / c.scale) * next;
    c.scale = next;
  };

  return (
    <div ref={wrapRef} className="relative h-[24rem] w-full overflow-hidden rounded-xl sm:h-[28rem]">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        className="touch-none select-none"
        style={{ cursor: "grab" }}
      />
      <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-neutral-400 backdrop-blur">
        {t.constellationHint}
      </p>
    </div>
  );
}
