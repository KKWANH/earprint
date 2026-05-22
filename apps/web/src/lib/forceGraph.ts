/**
 * Shared force-directed-graph physics — used by the artist map and the genre
 * constellation. The two components keep their own rendering and interaction
 * (they differ a lot); only the physics tick and a couple of pure helpers,
 * which were genuinely identical, live here.
 */

/** Live physics state for one node. */
export interface Sim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
}

/** An edge for the physics tick — `target` is the desired rest length. */
export interface PhysicsEdge {
  a: number;
  b: number;
  target: number;
}

export interface PhysicsOpts {
  repulsion: number;
  springK: number;
  gravity: number;
  damping: number;
}

/** Stable hue from a string — same input → same colour. */
export function genreHue(g: string): number {
  let h = 0;
  for (let i = 0; i < g.length; i++) h = (h * 31 + g.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

/**
 * One physics tick — Coulomb repulsion (all pairs) + spring attraction along
 * edges + gravity toward the origin, then integrate. Mutates `sim` in place.
 */
export function stepPhysics(
  sim: Sim[],
  edges: PhysicsEdge[],
  alpha: number,
  o: PhysicsOpts,
): void {
  const N = sim.length;
  for (let i = 0; i < N; i++) {
    const ni = sim[i]!;
    for (let j = i + 1; j < N; j++) {
      const nj = sim[j]!;
      let dx = ni.x - nj.x;
      let dy = ni.y - nj.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        d2 = 1;
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
      }
      const d = Math.sqrt(d2);
      const f = (o.repulsion * alpha) / d2;
      ni.vx += (dx / d) * f;
      ni.vy += (dy / d) * f;
      nj.vx -= (dx / d) * f;
      nj.vy -= (dy / d) * f;
    }
  }
  for (const e of edges) {
    const na = sim[e.a]!;
    const nb = sim[e.b]!;
    const dx = nb.x - na.x;
    const dy = nb.y - na.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - e.target) * o.springK * alpha;
    na.vx += (dx / d) * f;
    na.vy += (dy / d) * f;
    nb.vx -= (dx / d) * f;
    nb.vy -= (dy / d) * f;
  }
  for (const n of sim) {
    n.vx -= n.x * o.gravity * alpha;
    n.vy -= n.y * o.gravity * alpha;
    n.vx *= o.damping;
    n.vy *= o.damping;
    n.x += n.vx;
    n.y += n.vy;
  }
}
