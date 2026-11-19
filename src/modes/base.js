// sim: what every concept shares — aiming, firing, mid-air control (spin, tuck, puff), the judge, and effect events.
import { World, rng, STEP, centre } from '../engine.js';
import { Judge, movedCount } from '../noodle.js';

export const DT = STEP;

export class Mode {
  constructor(seed, opt = {}) {
    this.seed = seed; this.rnd = rng(seed); this.W = new World(opt.world);
    this.judge = new Judge(); this.fx = []; this.phase = 'aim'; this.noodle = null; this.cannon = null;
    this.maxPuffs = 3; this.puffs = 0; this.puffCd = 0; this.trail = []; this.t = 0; this.shotT = 0;
    this.bodies = []; this.grp = 1; this.feedSeen = 0; this.hint = ''; this.banner = null; this.tnt = [];
  }
  emit(type, d = {}) { this.fx.push(Object.assign({ type }, d)); }
  groundY() { return -1e9; }

  aimControl(inp) {
    const c = this.cannon; if (!c) return;
    if (inp.aim) {   // pointer: barrel points at the pointer, distance sets power
      const dx = inp.aim.x - c.x, dy = inp.aim.y - c.y, d = Math.hypot(dx, dy);
      if (d > 0.8) { c.angle = Math.max(c.minA, Math.min(c.maxA, Math.atan2(dy, dx) * 180 / Math.PI)); c.power = c.minP + (c.maxP - c.minP) * Math.max(0, Math.min(1, (d - 1.5) / 12)); }
    }
    c.aim((inp.up ? 1 : 0) * 45 * DT - (inp.down ? 1 : 0) * 45 * DT, ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * 14 * DT);
    if (inp.fireP) this.fire();
  }
  fire(c = this.cannon, spin = 0) {
    this.noodle = c.fire(this.W, { spin }); for (const p of this.noodle.list) p.grp = this.grp; this.grp++;
    this.bodies.push(this.noodle);
    const [x0] = this.noodle.com(); this.judge.start(this.noodle, x0);
    this.phase = 'fly'; this.puffs = this.maxPuffs; this.trail = []; this.shotT = 0; this.feedSeen = 0;
    const [mx, my] = c.mouth(); this.emit('boom', { x: mx, y: my, a: c.angle, power: c.power });
  }
  flyControl(inp) {
    const n = this.noodle; if (!n) return;
    const w = n.omega(), want = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);    // left = counter-clockwise
    if (want && (Math.sign(w) * want <= 0 || Math.abs(w) < 15)) n.spin(want * 16 * DT);   // torque up to a spin cap
    n.setTuck(!!inp.tuck);
    this.puffCd -= DT;
    if (inp.puffP && this.puffs > 0 && this.puffCd <= 0) {
      let dx = 0, dy = 0;
      if (inp.puffDir) { const [cx, cy] = n.com(); dx = inp.puffDir.x - cx; dy = inp.puffDir.y - cy; }
      else { dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0); dy = (inp.up ? 1 : 0) - (inp.down ? 1 : 0); }
      if (!dx && !dy) { const [vx] = n.vel(); dx = vx >= 0 ? 0.35 : -0.35; dy = 1; }
      const L = Math.hypot(dx, dy); n.push(dx / L * 7, dy / L * 7); this.puffs--; this.puffCd = 0.25;
      const [cx, cy] = n.com(); this.judge.puff(cx, cy); this.emit('puff', { x: cx, y: cy, dx: -dx / L, dy: -dy / L });
    }
  }
  // advance physics one tick and translate what happened into effects
  stepWorld() {
    const n = this.phase === 'fly' && this.noodle && !this.noodle.touching() ? this.noodle : null, L0 = n ? n.angular()[0] : 0;
    this.W.step(); this.t += DT;
    if (n) n.keepMomentum(L0);
    for (const e of this.W.events) {
      const ours = this.noodle && this.noodle.list.includes(e.p);
      if (e.other && e.other.kick && e.speed > 3) { this.emit('boing', { x: e.x, y: e.y, s: e.other }); e.other.flash = 1; }
      else if (e.speed > 7) this.emit('bonk', { x: e.x, y: e.y, speed: e.speed, ours, head: e.p.tag === 'head' });
      if (e.other && e.other.v && e.other.kind === 'tnt' && e.speed > 7) e.other.fuse = 1;
      if (e.other && e.other.kind === 'target' && !e.other.popped) { e.other.popped = true; this.popTarget(e.other); }
    }
    this.tntCheck();
    if (this.noodle && this.phase === 'fly') {
      this.shotT += DT;
      const [cx, cy] = this.noodle.com(); if ((this.W.frame & 1) === 0) { this.trail.push([cx, cy]); if (this.trail.length > 400) this.trail.shift(); }
      this.judge.tick(this.W, DT, { moved: movedCount(this.W), groundY: (x) => this.groundY(x) });
      const feed = this.judge.feed; while (this.feedSeen < feed.length) this.emit('trick', feed[this.feedSeen++]);
    }
  }
  popTarget(s) { const i = this.W.S.indexOf(s); if (i >= 0) this.W.S.splice(i, 1); this.judge.target(s.id, s.label || 'Balloon Pop!', s.pts || 150, s.x, s.y); this.emit('pop', { x: s.x, y: s.y, color: s.color }); }
  // TNT: a crate that goes off when hit hard (or shoved hard by a neighbour) and throws everything nearby
  tntCheck() {
    for (const q of this.W.Q) {
      if (q.kind !== 'tnt' || q.gone) continue;
      if (!q.fuse) { const v = q.v[0], sp = Math.hypot(v.vx0, v.vy0); if (sp > 9) q.fuse = 1; }
      if (q.fuse && ++q.fuse > 4) this.explode(q);
    }
  }
  explode(q) {
    const [x, y] = centre(q); q.gone = true;
    for (const p of q.v) { p.off = true; p.x = p.px = -9999; p.y = p.py = -9999; }
    this.W.C = this.W.C.filter(c => !q.v.includes(c.a)); this.W.Q.splice(this.W.Q.indexOf(q), 1);
    const R = 5.5;
    for (const o of this.W.Q) { const [ox, oy] = centre(o); if (Math.hypot(ox - x, oy - y) < R + 1) this.W.wake(o); }
    for (const p of this.W.P) {
      if (p.off || p.im === 0) continue; const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy); if (d > R || d < 1e-6) continue;
      const k = 22 * (1 - d / R); this.W.addVel(p, dx / d * k, dy / d * k + k * 0.3);
    }
    if (this.judge.chain) this.judge.target('tnt-' + q.id, 'KABOOM', 200, x, y);
    this.emit('kaboom', { x, y });
  }
}
export { centre };
