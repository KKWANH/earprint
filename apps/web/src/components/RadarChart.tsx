/**
 * Tiny SVG radar chart — used on /dna to render the novelty index's
 * variety / specificity / obscurity axes as a single shape rather than
 * three disconnected bars.
 *
 * Server-renderable (no hooks); accepts any number of axes (3+ looks good,
 * 2 collapses to a line and is ignored gracefully).
 */
export interface RadarAxis {
  label: string;
  value: number; // 0..1
  hint?: string;
}

export function RadarChart({
  axes,
  size = 240,
  ringCount = 4,
  className,
}: {
  axes: RadarAxis[];
  size?: number;
  ringCount?: number;
  className?: string;
}) {
  const n = axes.length;
  if (n < 3) return null;
  // Padding leaves room for axis labels outside the rings.
  const pad = 48;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - pad * 2) / 2;

  // Angle for axis i — start straight up, go clockwise.
  const angle = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const point = (i: number, v: number) => ({
    x: cx + Math.cos(angle(i)) * r * v,
    y: cy + Math.sin(angle(i)) * r * v,
  });

  const rings = Array.from({ length: ringCount }, (_, i) => (i + 1) / ringCount);
  const dataPath = axes
    .map((a, i) => {
      const p = point(i, Math.max(0.02, Math.min(1, a.value)));
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ") + " Z";

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label="Radar chart"
    >
      {/* concentric rings */}
      {rings.map((rr) => (
        <polygon
          key={rr}
          points={axes
            .map((_, i) => {
              const p = point(i, rr);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}
      {/* axis spokes */}
      {axes.map((_, i) => {
        const p = point(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x.toFixed(1)}
            y2={p.y.toFixed(1)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        );
      })}
      {/* data polygon */}
      <path
        d={dataPath}
        fill="rgba(52,211,153,0.22)"
        stroke="rgb(52,211,153)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* data points */}
      {axes.map((a, i) => {
        const p = point(i, Math.max(0.02, Math.min(1, a.value)));
        return (
          <circle
            key={i}
            cx={p.x.toFixed(1)}
            cy={p.y.toFixed(1)}
            r={3}
            fill="rgb(110,231,183)"
          />
        );
      })}
      {/* axis labels — pulled outward so they don't sit on the spokes */}
      {axes.map((a, i) => {
        const p = point(i, 1.18);
        const anchor =
          Math.abs(p.x - cx) < 4
            ? "middle"
            : p.x > cx
              ? "start"
              : "end";
        const dy = p.y < cy - 4 ? "-0.2em" : p.y > cy + 4 ? "0.9em" : "0.35em";
        return (
          <text
            key={i}
            x={p.x.toFixed(1)}
            y={p.y.toFixed(1)}
            textAnchor={anchor}
            dy={dy}
            className="fill-neutral-300 text-[10px] font-medium sm:text-[11px]"
          >
            {a.label}
          </text>
        );
      })}
      {/* value labels next to each point */}
      {axes.map((a, i) => {
        const p = point(i, Math.max(0.02, Math.min(1, a.value)));
        const out = point(i, Math.max(0.02, Math.min(1, a.value)) + 0.12);
        return (
          <text
            key={`v-${i}`}
            x={out.x.toFixed(1)}
            y={out.y.toFixed(1)}
            textAnchor="middle"
            dy="0.35em"
            className="fill-emerald-200 text-[9px] tabular-nums"
          >
            {Math.round(a.value * 100)}
          </text>
        );
      })}
    </svg>
  );
}
