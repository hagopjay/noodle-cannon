// sim: no DOM, no clock, no Math.random. Same inputs + same seed => same hash on one host.
// A small 2D position-based (Verlet) world: round particles, sticks with min/max length,
// dynamic convex quads (crates, planks) built from 4 particles, and static convex polygons / circles.
// Lesson kept from x3d.gamelab: cap push-out so overlap never becomes launch speed, solve at a fixed step.

export const STEP = 1 / 60;

export class World {
  constructor(opt = {}) {
    this.g = opt.g ?? -20;            // arcade gravity: punchier arcs than 9.81 at this scale
    this.sub = opt.sub ?? 3;          // substeps per 1/60 tick
    this.iters = opt.iters ?? 5;      // constraint/collision passes per substep
    this.h = STEP / this.sub;
    this.P = []; this.C = []; this.Q = []; this.S = [];
    this.events = []; this.frame = 0; this.time = 0;
    this.maxPush = opt.maxPush ?? 0.25; // metres per pass: deep overlaps bleed out instead of exploding
    this.wind = 0;
  }

  // ---------- construction ----------
  particle(o) {
    const p = {
      x: o.x, y: o.y, px: o.x - (o.vx || 0) * this.h, py: o.y - (o.vy || 0) * this.h,
      vx0: 0, vy0: 0, im: o.mass > 0 ? 1 / o.mass : 0, mass: o.mass || 0, r: o.r ?? 0.1,
      fric: o.fric ?? 0.5, rest: o.rest ?? 0.15, grp: o.grp || 0, drag: o.drag ?? 0.002, gs: o.gs ?? 1,
      quad: null, tag: o.tag || '', off: false, hit: null, kin: false,
    };
    this.P.push(p); return p;
  }
  stick(a, b, o = {}) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const c = { a, b, min: o.min ?? d, max: o.max ?? d, k: o.k ?? 1 };
    this.C.push(c); return c;
  }
  // Dynamic convex quad from centre, half sizes and angle. Corners are CCW.
  quad(o) {
    const { x, y, w, h } = o, a = o.a || 0, c = Math.cos(a), s = Math.sin(a), m = (o.mass ?? w * h * 4) / 4;
    const loc = [[-w, -h], [w, -h], [w, h], [-w, h]];
    const v = loc.map(([lx, ly]) => this.particle({ x: x + lx * c - ly * s, y: y + lx * s + ly * c, mass: o.kin ? 0 : m, r: 0.02, fric: o.fric ?? 0.6, rest: o.rest ?? 0.05, grp: -1 }));
    const q = { v, id: o.id || 'q' + this.Q.length, kind: o.kind || 'crate', sleep: 0, asleep: !!o.asleep, kin: !!o.kin, x0: x, y0: y, a0: a, moved: false, hp: o.hp ?? 1, color: o.color, w, h };
    for (const p of v) { p.quad = q; p.kin = q.kin; }
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) this.stick(v[i], v[j]);
    q.minx = q.maxx = q.miny = q.maxy = 0;
    this.Q.push(q); return q;
  }
  poly(pts, o = {}) {  // static convex polygon, any winding
    let area = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; area += x1 * y2 - x2 * y1; }
    const v = area < 0 ? pts.slice().reverse() : pts.slice();
    const n = v.map((p, i) => { const q = v[(i + 1) % v.length], ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey) || 1; return [ey / L, -ex / L]; });
    const xs = v.map(p => p[0]), ys = v.map(p => p[1]);
    const s = { type: 'poly', v, n, fric: o.fric ?? 0.6, rest: o.rest ?? 0.12, id: o.id || 's' + this.S.length, kind: o.kind || 'ground', kick: o.kick || 0,
      minx: Math.min(...xs), maxx: Math.max(...xs), miny: Math.min(...ys), maxy: Math.max(...ys) };
    this.S.push(s); return s;
  }
  circle(x, y, r, o = {}) {
    const s = { type: 'circle', x, y, r, fric: o.fric ?? 0.3, rest: o.rest ?? 0.3, kick: o.kick || 0, id: o.id || 's' + this.S.length, kind: o.kind || 'peg',
      minx: x - r, maxx: x + r, miny: y - r, maxy: y + r };
    this.S.push(s); return s;
  }

  // ---------- helpers used by game code ----------
  vel(p) { return [(p.x - p.px) / this.h, (p.y - p.py) / this.h]; }
  setVel(p, vx, vy) { p.px = p.x - vx * this.h; p.py = p.y - vy * this.h; }
  addVel(p, vx, vy) { p.px -= vx * this.h; p.py -= vy * this.h; }
  wake(q) {   // waking spreads to every sleeping crate touching this one, so nothing is left floating
    if (!q.asleep && !q.stir) return; q.stir = false; const todo = [q]; q.asleep = false; q.sleep = 0;
    while (todo.length) {
      const a = todo.pop(); this.bounds(a);
      for (const b of this.Q) if (b.asleep && !(a.maxx + 0.08 < b.minx || b.maxx + 0.08 < a.minx || a.maxy + 0.08 < b.miny || b.maxy + 0.08 < a.miny)) { b.asleep = false; b.sleep = 0; todo.push(b); }
    }
  }

  // ---------- the step ----------
  step() {
    const h = this.h;
    this.events.length = 0;
    for (let s = 0; s < this.sub; s++) {
      if (this.pre) this.pre(this.time + (s + 1) * h);   // kinematic movers set positions here (px = old, x = new)
      for (const p of this.P) {
        if (p.off) continue;
        const vx = p.x - p.px, vy = p.y - p.py;
        p.vx0 = vx / h; p.vy0 = vy / h; p.hit = null;
        if (p.im === 0 || (p.quad && p.quad.asleep)) { p.px = p.x; p.py = p.y; continue; }
        const sp = Math.hypot(p.vx0, p.vy0), k = Math.max(0, 1 - p.drag * sp * h);   // quadratic air drag
        const nvx = vx * k + (this.wind * p.drag * 8) * h * h, nvy = vy * k + this.g * p.gs * h * h;
        p.px = p.x; p.py = p.y; p.x += nvx; p.y += nvy;
      }
      for (const q of this.Q) this.bounds(q);
      this.free = this.P.filter(p => !p.off && !p.quad);
      for (let it = 0; it < this.iters; it++) {
        for (const c of this.C) this.solveStick(c);
        this.collide(it === this.iters - 1);
      }
      this.respond();
    }
    for (const q of this.Q) this.sleepCheck(q);
    this.frame++; this.time += STEP;
  }

  solveStick(c) {
    const a = c.a, b = c.b; if (a.off || b.off) return;
    const w = a.im + b.im; if (w === 0) return;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-9;
    const t = d < c.min ? c.min : d > c.max ? c.max : d; if (t === d) return;
    const f = c.k * (d - t) / d / w;
    a.x += dx * f * a.im; a.y += dy * f * a.im; b.x -= dx * f * b.im; b.y -= dy * f * b.im;
    if (a.quad && a.quad.asleep && !b.quad) this.wake(a.quad);
  }

  bounds(q) {
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (const p of q.v) { if (p.x < a) a = p.x; if (p.x > b) b = p.x; if (p.y < c) c = p.y; if (p.y > d) d = p.y; }
    q.minx = a; q.maxx = b; q.miny = c; q.maxy = d;
  }

  note(p, nx, ny, other, pen) { if (!p.hit || pen > p.hit.pen) p.hit = { nx, ny, other, pen }; }

  collide(last) {
    const P = this.P, S = this.S, Q = this.Q, mp = this.maxPush;
    // 1. every particle (incl. quad corners) vs static shapes
    for (const p of P) {
      if (p.off || p.im === 0 || (p.quad && p.quad.asleep)) continue;
      const r = p.r;
      for (const s of S) {
        if (p.x + r < s.minx || p.x - r > s.maxx || p.y + r < s.miny || p.y - r > s.maxy) continue;
        if (s.type === 'circle') {
          const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy), pen = s.r + r - d;
          if (pen > 0 && d > 1e-9) { const nx = dx / d, ny = dy / d, m = Math.min(pen, mp); p.x += nx * m; p.y += ny * m; this.note(p, nx, ny, s, pen); }
        } else {
          const res = circlePoly(p.x, p.y, r, s.v, s.n);
          if (res) { const m = Math.min(res[2], mp); p.x += res[0] * m; p.y += res[1] * m; this.note(p, res[0], res[1], s, res[2]); }
        }
      }
    }
    // 2. free particles (ragdoll, balls) vs dynamic quads, and vs each other (different groups)
    const F = this.free;
    for (const p of F) {
      for (const q of Q) {
        if (p.x + p.r < q.minx || p.x - p.r > q.maxx || p.y + p.r < q.miny || p.y - p.r > q.maxy) continue;
        const v = q.v, xs = [v[0].x, v[1].x, v[2].x, v[3].x], ys = [v[0].y, v[1].y, v[2].y, v[3].y];
        const res = circleQuad(p.x, p.y, p.r, xs, ys);
        if (!res) continue;
        const [nx, ny, pen, i, t] = res, e0 = v[i], e1 = v[(i + 1) & 3];
        const eim = q.asleep || q.kin ? 0 : (e0.im + e1.im) * 0.5, w = p.im + eim; if (w === 0) continue;
        if (q.asleep && p.im > 0) {   // wake only on a real hit
          const rvn = (p.vx0) * nx + (p.vy0) * ny; if (rvn < -3) { this.wake(q); }
        }
        const m = Math.min(pen, mp), sp = m * p.im / w, se = m * eim / w, lam = 1 / (t * t + (1 - t) * (1 - t));
        p.x += nx * sp; p.y += ny * sp;
        if (se > 0) { e0.x -= nx * se * (1 - t) * lam; e0.y -= ny * se * (1 - t) * lam; e1.x -= nx * se * t * lam; e1.y -= ny * se * t * lam; }
        this.note(p, nx, ny, q, pen);
      }
      for (const o of F) {
        if (o === p || (p.grp && p.grp === o.grp) || o.x < p.x - 3 || o.x > p.x + 3) continue;
        if (o.grp > 0 && p.grp > 0 && o.grp > p.grp) continue; // each pair once
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), pen = p.r + o.r - d, w = p.im + o.im;
        if (pen > 0 && d > 1e-9 && w > 0) {
          const nx = dx / d, ny = dy / d, m = Math.min(pen, mp);
          p.x += nx * m * p.im / w; p.y += ny * m * p.im / w; o.x -= nx * m * o.im / w; o.y -= ny * m * o.im / w;
          this.note(p, nx, ny, o, pen); this.note(o, -nx, -ny, p, pen);
        }
      }
    }
    // 3. quad vs quad (separating axis; the deepest corner is pushed out of the reference edge)
    for (let i = 0; i < Q.length; i++) {
      const A = Q[i];
      for (let j = i + 1; j < Q.length; j++) {
        const B = Q[j];
        if ((A.asleep || A.kin) && (B.asleep || B.kin)) continue;
        if (A.maxx < B.minx || B.maxx < A.minx || A.maxy < B.miny || B.maxy < A.miny) continue;
        this.quadQuad(A, B);
      }
    }
    for (const q of Q) if (!q.asleep) this.bounds(q);
  }

  quadQuad(A, B) {
    let best = 1e9, bn = null, ref = null, inc = null, ei = 0;
    for (const [E, O] of [[A, B], [B, A]]) {
      const v = E.v;
      for (let k = 0; k < 4; k++) {
        const a = v[k], b = v[(k + 1) & 3], ex = b.x - a.x, ey = b.y - a.y, L = Math.hypot(ex, ey) || 1e-9, nx = ey / L, ny = -ex / L;
        let mnE = 1e9, mxE = -1e9, mnO = 1e9, mxO = -1e9;
        for (const p of v) { const d = p.x * nx + p.y * ny; if (d < mnE) mnE = d; if (d > mxE) mxE = d; }
        for (const p of O.v) { const d = p.x * nx + p.y * ny; if (d < mnO) mnO = d; if (d > mxO) mxO = d; }
        const ov = Math.min(mxE - mnO, mxO - mnE); if (ov <= 0) return;
        if (ov < best) { best = ov; bn = [nx, ny]; ref = E; inc = O; ei = k; }
      }
    }
    let [nx, ny] = bn;
    const cE = centre(ref), cO = centre(inc);
    if ((cO[0] - cE[0]) * nx + (cO[1] - cE[1]) * ny < 0) { nx = -nx; ny = -ny; }
    // incident vertex: the corner of O deepest into E along n
    let vi = null, md = 1e9;
    for (const p of inc.v) { const d = (p.x - cE[0]) * nx + (p.y - cE[1]) * ny; if (d < md) { md = d; vi = p; } }
    const e0 = ref.v[ei], e1 = ref.v[(ei + 1) & 3], ex = e1.x - e0.x, ey = e1.y - e0.y;
    let t = Math.abs(ex) > Math.abs(ey) ? (vi.x - e0.x) / ex : (vi.y - e0.y) / ey; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const lam = 1 / (t * t + (1 - t) * (1 - t));
    const wI = inc.asleep || inc.kin ? 0 : vi.im, wE = ref.asleep || ref.kin ? 0 : (e0.im + e1.im) * 0.5, w = wI + wE;
    if (w === 0) {   // a moving body hit a sleeping stack: wake the sleeper and resolve next pass
      if (inc.asleep && !ref.asleep) this.wake(inc); else if (ref.asleep && !inc.asleep) this.wake(ref); return;
    }
    const sp = Math.min(best, this.maxPush);
    if (wI > 0) { vi.x += nx * sp * wI / w; vi.y += ny * sp * wI / w; }
    if (wE > 0) { const s = sp * wE / w; e0.x -= nx * s * (1 - t) * lam; e0.y -= ny * s * (1 - t) * lam; e1.x -= nx * s * t * lam; e1.y -= ny * s * t * lam; }
    // a hard hit on a sleeping quad wakes it
    const rv = (vi.vx0 - (e0.vx0 + e1.vx0) / 2) * nx + (vi.vy0 - (e0.vy0 + e1.vy0) / 2) * ny;
    if (rv < -2.5) { this.wake(A); this.wake(B); }
    this.note(vi, nx, ny, ref, best);
  }

  // once per substep: restitution, friction and impact events from the deepest contact of each particle
  respond() {
    const h = this.h;
    for (const p of this.P) {
      const c = p.hit; if (!c || p.im === 0) continue;
      const o = c.other, nx = c.nx, ny = c.ny;
      let ovx = 0, ovy = 0;
      if (o && !o.type && o.v) { ovx = (o.v[0].vx0 + o.v[2].vx0) / 2; ovy = (o.v[0].vy0 + o.v[2].vy0) / 2; }
      else if (o && !o.type && o.vx0 !== undefined) { ovx = o.vx0; ovy = o.vy0; }
      const rvx = p.vx0 - ovx, rvy = p.vy0 - ovy, vn = rvx * nx + rvy * ny;
      if (vn < -4 && !p.quad) this.events.push({ p, other: o, speed: -vn, x: p.x, y: p.y, nx, ny });
      if (o && o.type) {   // static surface: we own the velocity response
        const tvx = rvx - vn * nx, tvy = rvy - vn * ny;
        const fr = Math.max(p.fric, o.fric), rest = Math.max(p.rest, o.rest);
        let nvn = vn < -1.5 ? -vn * rest : Math.max(vn, 0);
        if (o.kick && vn < 0) nvn = Math.max(nvn, o.kick);
        // Coulomb friction: tangential speed drops by mu times the normal speed change (impacts grip, resting slides decelerate at mu*g)
        const dvn = nvn - vn + Math.max(0, -this.g * p.gs * ny) * h, vt = Math.hypot(tvx, tvy), keep = vt > 1e-9 ? Math.max(0, 1 - fr * dvn / vt) : 0;
        p.px = p.x - (tvx * keep + nvn * nx) * h; p.py = p.y - (tvy * keep + nvn * ny) * h;
      } else if (o && p.quad && o.v) {   // corner resting on another crate: inelastic + Coulomb, relative to the other body
        const tvx = rvx - vn * nx, tvy = rvy - vn * ny, fr = 0.5, dvn = Math.max(0, -vn) + Math.abs(this.g) * h;
        const vt = Math.hypot(tvx, tvy), keep = vt > 1e-9 ? Math.max(0, 1 - fr * dvn / vt) : 0, nvn = Math.max(vn, 0);
        const cvx = (p.x - p.px) / h, cvy = (p.y - p.py) / h, wvx = ovx + tvx * keep + nvn * nx, wvy = ovy + tvy * keep + nvn * ny;
        p.px = p.x - (cvx * 0.5 + wvx * 0.5) * h; p.py = p.y - (cvy * 0.5 + wvy * 0.5) * h;
      }
    }
  }

  sleepCheck(q) {
    if (q.kin || q.asleep) return;
    let m = 0; for (const p of q.v) m = Math.max(m, Math.abs(p.x - p.px) + Math.abs(p.y - p.py));
    if (m < 0.0015) { if (++q.sleep > 45) { q.asleep = true; for (const p of q.v) { p.px = p.x; p.py = p.y; } } } else { q.sleep = 0; if (m > 0.01) { q.stir = true; this.wake(q); } }
    if (!q.moved) { const c = centre(q); if (Math.hypot(c[0] - q.x0, c[1] - q.y0) > 0.6 || Math.abs(quadAngle(q) - q.a0) > 0.6) q.moved = true; }
  }

  hash() {
    let hsh = 2166136261 >>> 0;
    const mix = (v) => { const n = Math.round(v * 1e5) | 0; hsh ^= n & 0xffff; hsh = Math.imul(hsh, 16777619) >>> 0; hsh ^= (n >>> 16) & 0xffff; hsh = Math.imul(hsh, 16777619) >>> 0; };
    for (const p of this.P) { mix(p.x); mix(p.y); }
    return hsh.toString(16).padStart(8, '0');
  }
}

export function centre(q) { const v = q.v; return [(v[0].x + v[1].x + v[2].x + v[3].x) / 4, (v[0].y + v[1].y + v[2].y + v[3].y) / 4]; }
export function quadAngle(q) { const v = q.v; return Math.atan2(v[1].y - v[0].y, v[1].x - v[0].x); }

// circle vs static convex polygon (CCW verts, outward normals) -> [nx, ny, pen] or null
function circlePoly(px, py, r, v, n) {
  let best = -1e9, bi = -1; const L = v.length;
  for (let i = 0; i < L; i++) { const d = (px - v[i][0]) * n[i][0] + (py - v[i][1]) * n[i][1]; if (d >= r) return null; if (d > best) { best = d; bi = i; } }
  const a = v[bi], b = v[(bi + 1) % L], ex = b[0] - a[0], ey = b[1] - a[1], t = ((px - a[0]) * ex + (py - a[1]) * ey) / (ex * ex + ey * ey);
  if (best > 0 && (t < 0 || t > 1)) {   // outside, past a corner: the corner is the closest point
    const c = t < 0 ? a : b, dx = px - c[0], dy = py - c[1], d = Math.hypot(dx, dy);
    if (d >= r || d < 1e-9) return null; return [dx / d, dy / d, r - d];
  }
  return [n[bi][0], n[bi][1], r - best];
}
// circle vs dynamic quad (CCW corners) -> [nx, ny, pen, edgeIndex, t] or null
function circleQuad(px, py, r, xs, ys) {
  let best = -1e9, bi = -1, bnx = 0, bny = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) & 3, ex = xs[j] - xs[i], ey = ys[j] - ys[i], L = Math.hypot(ex, ey) || 1e-9, nx = ey / L, ny = -ex / L;
    const d = (px - xs[i]) * nx + (py - ys[i]) * ny; if (d >= r) return null;
    if (d > best) { best = d; bi = i; bnx = nx; bny = ny; }
  }
  const j = (bi + 1) & 3, ex = xs[j] - xs[bi], ey = ys[j] - ys[bi];
  let t = ((px - xs[bi]) * ex + (py - ys[bi]) * ey) / (ex * ex + ey * ey);
  if (best > 0 && (t < 0 || t > 1)) {
    const cx = t < 0 ? xs[bi] : xs[j], cy = t < 0 ? ys[bi] : ys[j], dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
    if (d >= r || d < 1e-9) return null; return [dx / d, dy / d, r - d, bi, t < 0 ? 0 : 1];
  }
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [bnx, bny, r - best, bi, t];
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function seedFrom(str) { let h = 2166136261 >>> 0; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
