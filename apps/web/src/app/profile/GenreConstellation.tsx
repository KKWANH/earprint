"use client";

import { useEffect, useRef, useState } from "react";
import { genreHue, stepPhysics, type Sim } from "@/lib/forceGraph";
import type { GenreMapData } from "@/lib/genreMap";
import type { Locale } from "@/lib/i18n";
import { profileDict } from "@/lib/i18n/profile";
import { CanvasShareMenu } from "@/components/CanvasShareMenu";
import { canvasShareDict } from "@/lib/i18n/canvasShare";

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

    // Per-node twinkle phase so each "star" pulses independently. Seeded
    // from its index so the pattern is stable across re-renders (not
    // randomised every frame, which would look noisy).
    const twinkleSeed = (i: number) => (i * 137.5) % (Math.PI * 2);

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
      const t = performance.now() / 1000;

      // Deep-space gradient background — radial from a slightly off-centre
      // origin so the eye doesn't sit on a perfectly centred vignette.
      // Differentiates the constellation from the artist map (which is a
      // flat-bg force layout) at a single glance.
      const bg = ctx.createRadialGradient(
        w * 0.4,
        h * 0.55,
        Math.min(w, h) * 0.1,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.75,
      );
      bg.addColorStop(0, "#0e1024");
      bg.addColorStop(0.55, "#06070f");
      bg.addColorStop(1, "#000000");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Static "field stars" — a sparse scatter of pinpricks behind the
      // genre nodes that doesn't track the camera. Sells the cosmic
      // background without competing with the real stars. Generated
      // deterministically from a hash of (x,y) so the scatter is stable
      // across frames (no per-frame randomisation = no shimmer).
      ctx.fillStyle = "rgba(220,230,255,0.35)";
      for (let i = 0; i < 80; i++) {
        // Mulberry-32-ish deterministic pseudo-random from i.
        const h1 = (i * 2654435761) >>> 0;
        const h2 = (i * 40503) >>> 0;
        const fx = ((h1 % 10000) / 10000) * w;
        const fy = ((h2 % 10000) / 10000) * h;
        // Subtle independent twinkle on the field stars too — same phase
        // function as the genre stars, just way fainter so they read as
        // ambient noise rather than as elements you can interact with.
        const fa = 0.25 + 0.15 * Math.sin(t * 0.7 + i * 0.9);
        ctx.globalAlpha = Math.max(0.05, fa);
        ctx.fillRect(fx, fy, 1, 1);
      }
      ctx.globalAlpha = 1;
      const focus = selRef.current ?? hover.current;
      const nbr = focus != null ? neighbors.current[focus] : null;

      // Edges = constellation lines. Default to faint hairlines so the
      // stars carry the visual weight, not the graph mesh. Only edges
      // above ~40% relative weight are visible at rest; everything else
      // appears on focus. Width stays 0.6 px so the lines read as
      // pencil-thin against the bright stars.
      ctx.lineCap = "round";
      for (const e of edges) {
        const lit = focus != null && (e.a === focus || e.b === focus);
        const wRatio = e.weight / maxW;
        // Skip rendering super-weak edges when not focused — keeps the
        // background airy. When focused on a node we draw every neighbour
        // edge regardless so the constellation pattern reads clearly.
        if (!lit && focus != null) continue;
        if (!lit && wRatio < 0.35) continue;
        ctx.lineWidth = lit ? 1.2 : 0.6;
        ctx.strokeStyle = lit
          ? "rgba(220,230,255,0.65)"
          : `rgba(180,195,235,${0.08 + wRatio * 0.18})`;
        ctx.beginPath();
        ctx.moveTo(sim[e.a]!.x * scale + ox, sim[e.a]!.y * scale + oy);
        ctx.lineTo(sim[e.b]!.x * scale + ox, sim[e.b]!.y * scale + oy);
        ctx.stroke();
      }

      // Stars — three concentric layers + diffraction spikes on bright
      // ones. Each star carries:
      //   • A radial-gradient halo (color → transparent) instead of a
      //     flat-fill disk, so the outer falloff reads physically.
      //   • Mid glow tinted by genre hue (warm/cool depending on the
      //     genre's place on the hue wheel).
      //   • White-hot core fill so the centre always reads as "bright".
      //   • 4-point cross flare (lens spike) on the brightest 25% of
      //     stars — the classic CCD diffraction artefact, sells the
      //     "really is a star" feeling at a glance.
      // Radius from the physics sim acts as magnitude (count-weighted):
      // bigger genres = bigger, brighter star.
      //
      // Sort by radius so brighter stars are drawn last — keeps their
      // halos on top of dimmer neighbours instead of being obscured.
      const drawOrder = [...Array(N).keys()].sort((a, b) => sim[a]!.r - sim[b]!.r);
      // What counts as "bright enough to spike". Top quartile of radii.
      const radii = sim.map((s) => s.r).sort((a, b) => a - b);
      const spikeThreshold = radii[Math.floor(radii.length * 0.75)] ?? 999;

      for (const i of drawOrder) {
        const s = sim[i]!;
        const px = s.x * scale + ox;
        const py = s.y * scale + oy;
        const dim = focus != null && i !== focus && !(nbr && nbr.has(i));
        const r = s.r * scale;
        // Twinkle: 0.7 ↔ 1.0 multiplier on halo opacity. Each star
        // gets its own phase, plus a small radius variation so the
        // spikes pulse subtly too.
        const twink = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.3 + twinkleSeed(i)));
        const baseAlpha = dim ? 0.18 : 1;

        // Diffraction spikes — only for the brightest stars, scaled
        // by radius so big genres get visibly bigger flares. Drawn
        // FIRST so the halo + core overlay them at the centre.
        if (!dim && s.r >= spikeThreshold) {
          const spikeLen = r * (3.2 + twink * 0.6);
          ctx.globalAlpha = baseAlpha * 0.6 * twink;
          ctx.strokeStyle = `hsl(${s.hue} 90% 80%)`;
          ctx.lineCap = "round";
          // Horizontal spike thins out toward the tip.
          ctx.lineWidth = Math.max(0.7, r * 0.18);
          ctx.beginPath();
          ctx.moveTo(px - spikeLen, py);
          ctx.lineTo(px + spikeLen, py);
          ctx.stroke();
          // Vertical spike, slightly shorter — looks more "lens-real".
          ctx.beginPath();
          ctx.moveTo(px, py - spikeLen * 0.85);
          ctx.lineTo(px, py + spikeLen * 0.85);
          ctx.stroke();
        }

        // Halo (outer glow) — radial gradient instead of solid disk so
        // the outer edge fades naturally and the halo doesn't clip a
        // hard circle against neighbours.
        const haloR = r * 3.6;
        const halo = ctx.createRadialGradient(px, py, r * 0.6, px, py, haloR);
        halo.addColorStop(0, `hsla(${s.hue}, 80%, 70%, ${0.55 * twink})`);
        halo.addColorStop(0.55, `hsla(${s.hue}, 70%, 55%, ${0.2 * twink})`);
        halo.addColorStop(1, `hsla(${s.hue}, 60%, 45%, 0)`);
        ctx.globalAlpha = baseAlpha;
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(px, py, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Mid glow — tighter, more saturated. Drives the perceived hue
        // of the star against the dark background.
        ctx.globalAlpha = baseAlpha * 0.85;
        ctx.beginPath();
        ctx.arc(px, py, r * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${s.hue} 80% 62%)`;
        ctx.fill();

        // Bright core — white-hot, slightly tinted toward the hue at
        // the edge so it doesn't read as a hard cut-out. Use a tiny
        // radial so the centre is pure white but the rim picks up
        // the star colour. Visible on stars of any size.
        const coreR = Math.max(1.5, r * 0.55);
        const core = ctx.createRadialGradient(px, py, 0, px, py, coreR);
        core.addColorStop(0, "#ffffff");
        core.addColorStop(0.7, `hsl(${s.hue} 95% 92%)`);
        core.addColorStop(1, `hsl(${s.hue} 90% 82%)`);
        ctx.globalAlpha = baseAlpha;
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(px, py, coreR, 0, Math.PI * 2);
        ctx.fill();

        if (i === focus) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.arc(px, py, r * 1.9, 0, Math.PI * 2);
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
  // React's synthetic onWheel is bound as a passive listener, so calling
  // preventDefault() on its event has no effect — the page kept scrolling
  // alongside the zoom and visitors complained the constellation card was
  // unusable on a phone or trackpad. We register a NATIVE wheel listener
  // with passive: false instead so preventDefault sticks.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      // Only swallow the scroll when the pointer is genuinely over the
      // canvas (event.target check is implicit by binding to the canvas).
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const c = cam.current;
      const next = Math.min(
        4,
        Math.max(0.3, c.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)),
      );
      c.x = sx - ((sx - c.x) / c.scale) * next;
      c.y = sy - ((sy - c.y) / c.scale) * next;
      c.scale = next;
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);

  return (
    <div ref={wrapRef} className="relative h-[24rem] w-full overflow-hidden rounded-xl sm:h-[28rem]">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        // wheel handler registered as native non-passive listener via
        // useEffect above — React's onWheel prop can't preventDefault.
        className="touch-none select-none overscroll-contain"
        style={{ cursor: "grab" }}
      />
      <div className="absolute right-2 top-2">
        <CanvasShareMenu
          canvasRef={canvasRef}
          strings={canvasShareDict(locale)}
          filename="earprint-constellation"
          embedAlt="My taste constellation — Earprint"
        />
      </div>
      <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-neutral-400 backdrop-blur">
        {t.constellationHint}
      </p>
    </div>
  );
}
