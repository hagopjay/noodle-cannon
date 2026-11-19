// sim: the noodle (ragdoll), the cannon and the trick judge. No DOM.
import { centre } from './engine.js';

// name, x, y (pelvis at 0,0, standing), radius, mass
const BODY = [
  ['head', 0, 1.05, 0.2, 1.2], ['chest', 0, 0.55, 0.21, 3], ['pelvis', 0, 0, 0.19, 2.5],
  ['elbowL', -0.36, 0.5, 0.09, 0.4], ['handL', -0.68, 0.46, 0.085, 0.3], ['elbowR', 0.36, 0.5, 0.09, 0.4], ['handR', 0.68, 0.46, 0.085, 0.3],
  ['kneeL', -0.12, -0.45, 0.1, 0.8], ['footL', -0.15, -0.9, 0.09, 0.6], ['kneeR', 0.12, -0.45, 0.1, 0.8], ['footR', 0.15, -0.9, 0.09, 0.6],
];
const BONES = [['head', 'chest'], ['chest', 'pelvis'], ['chest', 'elbowL'], ['elbowL', 'handL'], ['chest', 'elbowR'], ['elbowR', 'handR'],
  ['pelvis', 'kneeL'], ['kneeL', 'footL'], ['pelvis', 'kneeR'], ['kneeR', 'footR']];
// soft joint limits: [a, b, min, max] as fractions of rest length
const LIMITS = [['head', 'pelvis', 0.8, 1.0], ['chest', 'kneeL', 0.38, 1.05], ['chest', 'kneeR', 0.38, 1.05], ['pelvis', 'footL', 0.3, 1.0], ['pelvis', 'footR', 0.3, 1.0],
  ['chest', 'handL', 0.25, 1.0], ['chest', 'handR', 0.25, 1.0], ['kneeL', 'kneeR', 0.4, 4], ['head', 'handL', 0.2, 9], ['head', 'handR', 0.2, 9]];
// tucked: muscles pull these toward the given fraction (a cannonball dive)
const TUCK = [['pelvis', 'footL', 0.32], ['pelvis', 'footR', 0.32], ['chest', 'kneeL', 0.4], ['chest', 'kneeR', 0.4], ['chest', 'handL', 0.28], ['chest', 'handR', 0.28], ['head', 'pelvis', 0.82]];

export class Noodle {
  constructor(W, x, y, vx, vy, opt = {}) {
    this.W = W; this.parts = {}; this.list = [];
    const rot = opt.angle ?? 0, c = Math.cos(rot), s = Math.sin(rot);   // rot: 0 = standing; -PI/2 = head pointing +x
    for (const [n, bx, by, r, m] of BODY) {
      const p = W.particle({ x: x + bx * c - by * s, y: y + bx * s + by * c, vx, vy, r, mass: m, grp: opt.grp || 1, fric: 0.55, rest: 0.18, drag: 0.004, tag: n });
      this.parts[n] = p; this.list.push(p);
    }
    const P = this.parts;
    for (const [a, b] of BONES) W.stick(P[a], P[b]);
    this.muscles = [];
    for (const [a, b, mn, mx] of LIMITS) { const d = Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y); const st = W.stick(P[a], P[b], { min: d * mn, max: d * mx, k: 0.6 }); st.rest = d; st.fmin = mn; st.fmax = mx; this.muscles.push([a, b, st]); }
    this.tuckSt = TUCK.map(([a, b, f]) => { const st = this.muscles.find(m => m[0] === a && m[1] === b)[2]; return [st, f]; });
    this.tucked = 0;
    if (opt.spin) this.spin(opt.spin);
  }
  com() { let x = 0, y = 0, m = 0; for (const p of this.list) { x += p.x * p.mass; y += p.y * p.mass; m += p.mass; } return [x / m, y / m]; }
  vel() { let x = 0, y = 0, m = 0; for (const p of this.list) { const [vx, vy] = this.W.vel(p); x += vx * p.mass; y += vy * p.mass; m += p.mass; } return [x / m, y / m]; }
  angle() { const a = this.parts.chest, b = this.parts.pelvis; return Math.atan2(a.y - b.y, a.x - b.x); }
  // add angular velocity (rad/s) about the centre of mass
  spin(dw) { const [cx, cy] = this.com(); for (const p of this.list) this.W.addVel(p, -(p.y - cy) * dw, (p.x - cx) * dw); }
  push(vx, vy) { for (const p of this.list) this.W.addVel(p, vx, vy); }
  // angular momentum about the COM, and inertia: tuck lowers inertia, so the same momentum spins faster
  omega() {
    const [cx, cy] = this.com(), [vx, vy] = this.vel(); let L = 0, I = 0;
    for (const p of this.list) { const rx = p.x - cx, ry = p.y - cy, [px, py] = this.W.vel(p); L += p.mass * (rx * (py - vy) - ry * (px - vx)); I += p.mass * (rx * rx + ry * ry); }
    return L / (I || 1);
  }
  angular() {
    const [cx, cy] = this.com(), [vx, vy] = this.vel(); let L = 0, I = 0;
    for (const p of this.list) { const rx = p.x - cx, ry = p.y - cy, [px, py] = this.W.vel(p); L += p.mass * (rx * (py - vy) - ry * (px - vx)); I += p.mass * (rx * rx + ry * ry); }
    return [L, I];
  }
  // Position-based muscles shorten the chord a limb travels, which bleeds angular momentum (a known PBD loss).
  // In free flight we put it back, so tucking really does spin you up like a diver.
  keepMomentum(L0) { if (this.touching()) return; const [L, I] = this.angular(); if (I > 1e-6) this.spin((L0 - L) / I); }
  setTuck(on) {
    this.tucked = on ? 1 : 0;
    for (const [st, f] of this.tuckSt) { st.max = st.rest * (on ? f : st.fmax); st.k = on ? 0.5 : 0.6; }
    for (const p of this.list) p.drag = on ? 0.002 : 0.004;     // spread out = more drag, a little glide
  }
  touching() { return this.list.some(p => p.hit); }
  remove() { for (const p of this.list) { p.off = true; p.x = p.px = -9999; p.y = p.py = -9999; } }
  speed() { const [vx, vy] = this.vel(); return Math.hypot(vx, vy); }
}

export class Cannon {
  constructor(x, y, o = {}) {
    this.x = x; this.y = y; this.angle = o.angle ?? 40; this.power = o.power ?? 26;
    this.minA = o.minA ?? 5; this.maxA = o.maxA ?? 85; this.minP = o.minP ?? 10; this.maxP = o.maxP ?? 42;
    this.len = 1.9; this.recoil = 0; this.flash = 0; this.id = o.id || 'cannon';
  }
  mouth() { const a = this.angle * Math.PI / 180; return [this.x + Math.cos(a) * this.len, this.y + Math.sin(a) * this.len]; }
  aim(dA, dP) { this.angle = Math.max(this.minA, Math.min(this.maxA, this.angle + dA)); this.power = Math.max(this.minP, Math.min(this.maxP, this.power + dP)); }
  // preview of the first `t` seconds of the drag-free arc
  arc(g, t = 0.6, n = 18) {
    const a = this.angle * Math.PI / 180, [mx, my] = this.mouth(), vx = Math.cos(a) * this.power, vy = Math.sin(a) * this.power, out = [];
    for (let i = 0; i <= n; i++) { const tt = (t * i) / n; out.push([mx + vx * tt, my + vy * tt + 0.5 * g * tt * tt]); }
    return out;
  }
  fire(W, opt = {}) {
    const a = this.angle * Math.PI / 180, [mx, my] = this.mouth(), vx = Math.cos(a) * this.power, vy = Math.sin(a) * this.power;
    this.recoil = 1; this.flash = 1;
    return new Noodle(W, mx - Math.cos(a) * 0.4, my - Math.sin(a) * 0.4, vx, vy, { angle: a - Math.PI / 2, spin: opt.spin ?? 0, grp: 1 });
  }
}

// ---------- the judge: every shot is a chain; variety of trick families raises the multiplier ----------
export const FAMILIES = { air: 'Air', spin: 'Spin', bonk: 'Bonk', smash: 'Smash', boing: 'Boing', puff: 'Puff', target: 'Target', skim: 'Skim', far: 'Distance', tuck: 'Tuck' };

export class Judge {
  constructor() { this.feed = []; this.reset(); }
  reset() {
    this.chain = null; this.feed.length = 0;
  }
  start(noodle, x0) {
    this.chain = { noodle, x0, air: 0, maxAir: 0, rot: 0, la: noodle.angle(), flips: 0, tuckFlips: 0, tuckRot: 0, bonked: new Set(), bonks: 0, smashed: 0,
      boings: 0, puffs: 0, score: 0, raw: 0, fam: new Set(), keys: new Set(), mult: 1, dist: 0, skimT: 0, t: 0, still: 0, hardest: 0, landed: false };
  }
  award(key, title, pts, fam, x, y) {
    const c = this.chain; if (!c || c.keys.has(key)) return false;
    c.keys.add(key); c.fam.add(fam); c.raw += pts;
    c.mult = Math.min(5, 1 + Math.floor(c.fam.size / 2));
    c.score = Math.round(c.raw * c.mult);
    this.feed.push({ key, title, pts, fam, x, y, mult: c.mult });
    return true;
  }
  // called once per tick while a noodle is live. world: { W, quadsMovedCount(), groundY(x) }
  tick(W, dt, ctx = {}) {
    const c = this.chain; if (!c) return;
    const n = c.noodle, [cx, cy] = n.com(); c.t += dt;
    const touching = n.touching();
    if (!touching) { c.air += dt; c.maxAir = Math.max(c.maxAir, c.air); } else c.air = 0;
    const airs = [[0.8, 'Hang Time', 60], [1.6, 'Frequent Flyer', 110], [2.6, 'Low Earth Orbit', 180], [4, 'Air Traffic Control Is Concerned', 300]];
    airs.forEach(([s, t, p], i) => { if (c.air >= s) this.award('air' + i, t, p, 'air', cx, cy); });
    // net rotation of the torso, unwrapped
    const a = n.angle(); let d = a - c.la; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; c.la = a;
    c.rot += d; if (n.tucked) c.tuckRot += Math.abs(d);
    const flips = Math.floor(Math.abs(c.rot) / (2 * Math.PI));
    while (c.flips < flips) { c.flips++; this.award('flip' + c.flips, ['Full Rotation', 'Double Tumble', 'Triple Laundry Cycle', 'Quad Squad', 'Centrifuge Certified'][Math.min(4, c.flips - 1)], [120, 140, 170, 210, 260][Math.min(4, c.flips - 1)], 'spin', cx, cy); }
    if (c.tuckRot >= 4 * Math.PI) this.award('tuck', 'Cannonball Dive', 150, 'tuck', cx, cy);
    // impacts
    for (const e of W.events) {
      if (!n.list.includes(e.p)) continue;
      c.hardest = Math.max(c.hardest, e.speed);
      const o = e.other; if (!o || e.speed < 6) continue;
      if (o.kick) { c.boings++; this.award('boing' + Math.min(c.boings, 3), ['Boing!', 'Boing Boing!', 'Professional Bouncer'][Math.min(c.boings, 3) - 1], [70, 90, 140][Math.min(c.boings, 3) - 1], 'boing', e.x, e.y); continue; }
      const id = o.id || o.tag || 'thing';
      if (!c.bonked.has(id) && (o.v || o.kind === 'peg' || o.tag === 'ball' || o.kind === 'target')) {
        c.bonked.add(id); c.bonks++;
        this.award('bonk' + Math.min(c.bonks, 4), ['Bonk!', 'Second Bonk', 'Bonk Trilogy', 'Bonk Cinematic Universe'][Math.min(c.bonks, 4) - 1], [50, 70, 100, 150][Math.min(c.bonks, 4) - 1], 'bonk', e.x, e.y);
      }
    }
    // destruction caused during this shot
    if (ctx.moved !== undefined) {
      const m = ctx.moved - (c.moved0 ?? (c.moved0 = ctx.moved)); c.smashed = m;
      [[1, 'Property Damage', 60], [4, 'Structural Critique', 140], [8, 'Demolition Derby', 260], [14, 'Insurance Nightmare', 420]].forEach(([k, t, p], i) => { if (m >= k) this.award('smash' + i, t, p, 'smash', cx, cy); });
    }
    // skimming: fast, low and not touching
    if (ctx.groundY) {
      const lo = Math.min(...n.list.map(p => p.y - p.r - ctx.groundY(p.x)));
      if (!touching && lo < 0.7 && lo > 0 && n.speed() > 10) { c.skimT += dt; if (c.skimT > 0.25) this.award('skim', 'Lawn Mower', 120, 'skim', cx, cy); } else c.skimT = 0;
    }
    c.dist = Math.max(c.dist, cx - c.x0);
    [[25, 'Long Haul', 40], [50, 'Postal Service', 90], [80, 'Interstate Noodle', 160], [120, 'Different Postcode', 260]].forEach(([k, t, p], i) => { if (c.dist >= k) this.award('far' + i, t, p, 'far', cx, cy); });
    c.still = n.speed() < 1.2 && c.t > 0.8 ? c.still + dt : 0;
  }
  puff(x, y) { const c = this.chain; if (!c) return; c.puffs++; this.award('puff' + c.puffs, ['Mid-air Sneeze', 'Second Wind', 'Weather System'][c.puffs - 1] || 'Puff', 40, 'puff', x, y); }
  target(key, title, pts, x, y) { this.award('target-' + key, title, pts, 'target', x, y); }
  finish() { const c = this.chain; this.chain = null; if (!c) return null;
    return { score: c.score, mult: c.mult, families: [...c.fam], flips: c.flips, air: +c.maxAir.toFixed(2), bonks: c.bonks, smashed: c.smashed, dist: +c.dist.toFixed(1), puffs: c.puffs, tricks: c.keys.size, hardest: +c.hardest.toFixed(1) }; }
}

export function movedCount(W) { let n = 0; for (const q of W.Q) if (q.moved && !q.kin) n++; return n; }
export { centre };
