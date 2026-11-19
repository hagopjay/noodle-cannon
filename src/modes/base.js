// sim: what every concept shares — aiming, firing every kind of ammo, mid-air control (spin, tuck, spread/glide, puff),
// the special action of each ammo, toys that react (TNT, balloons), the judge, and effect events.
import { World, rng, STEP, centre } from '../engine.js';
import { Judge, Noodle, movedCount, pinsDown } from '../noodle.js';

export const DT = STEP;

export const AMMO = {
  noodle: { name: 'Noodle', icon: '🍝', key: '1', desc: 'The classic. Three puffs.' },
  triple: { name: 'Triple', icon: '🔱', key: '2', desc: 'Three noodles in a fan. Puffs push all three.' },
  sticky: { name: 'Sticky', icon: '🕷️', key: '3', desc: 'Hands grab the first thing they touch. Space lets go (twice per shot).' },
  rocket: { name: 'Rocket', icon: '🚀', key: '4', desc: 'Hold Space: rocket boots on your feet. 1.6 s of fuel. Good luck.' },
  bomb: { name: 'Bomb', icon: '💣', key: '5', desc: 'Space: blow yourself up. Rocket-jumps you toward your arrows.' },
  ball: { name: 'Munchausen', icon: '⚫', key: '6', desc: 'Ride a 30 kg cannonball. Space lets go; the ball keeps smashing.' },
};

export class Mode {
  constructor(seed, opt = {}) {
    this.seed = seed; this.rnd = rng(seed); this.W = new World(opt.world);
    this.judge = new Judge(); this.fx = []; this.phase = 'aim'; this.noodle = null; this.cannon = null;
    this.maxPuffs = 3; this.puffs = 0; this.puffCd = 0; this.trail = []; this.t = 0; this.shotT = 0;
    this.bodies = []; this.grp = 1; this.feedSeen = 0; this.hint = ''; this.banner = null;
    this.ammo = 'noodle'; this.inv = { noodle: Infinity }; this.sp = null; this.lift = 0;
  }
  // let new structures sag and settle before play, so nothing counts as damage that the player did not do
  settle(n = 150) { for (let i = 0; i < n; i++) this.W.step(); for (const q of this.W.Q) { const [x, y] = centre(q); q.x0 = x; q.y0 = y; q.a0 = Math.atan2(q.v[1].y - q.v[0].y, q.v[1].x - q.v[0].x); q.moved = false; } this.W.events.length = 0; }
  emit(type, d = {}) { this.fx.push(Object.assign({ type }, d)); }
  groundY() { return -1e9; }
  pickAmmo(id) { if (this.phase === 'aim' && this.inv[id] > 0) { this.ammo = id; this.emit('ammo', { id }); } }
  cycleAmmo(d) { const ks = Object.keys(AMMO).filter(k => this.inv[k] > 0); const i = ks.indexOf(this.ammo); this.pickAmmo(ks[(i + d + ks.length) % ks.length]); }

  aimControl(inp) {
    const c = this.cannon; if (!c) return;
    if (inp.ammo) this.pickAmmo(inp.ammo);
    if (inp.cycle) this.cycleAmmo(inp.cycle);
    if (inp.aim) {   // pointer: barrel points at the pointer, distance sets power
      const dx = inp.aim.x - c.x, dy = inp.aim.y - c.y, d = Math.hypot(dx, dy);
      if (d > 0.8) { let a = Math.atan2(dy, dx) * 180 / Math.PI; if (a < -90) a += 360; c.angle = Math.max(c.minA, Math.min(c.maxA, a)); c.power = c.minP + (c.maxP - c.minP) * Math.max(0, Math.min(1, (d - 1.5) / 12)); }
    }
    const flip = c.angle > 90 ? -1 : 1;   // a cannon facing left: up still means "raise the barrel"
    c.aim(((inp.up ? 1 : 0) - (inp.down ? 1 : 0)) * 45 * DT * flip, ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * 14 * DT * flip);
    if (inp.fireP) this.fire();
  }

  // ---------- firing ----------
  fire(c = this.cannon, spin = 0) {
    const kind = this.inv[this.ammo] > 0 ? this.ammo : 'noodle';
    if (this.inv[kind] !== Infinity) this.inv[kind]--;
    const extra = [];
    if (kind === 'triple') {
      const a0 = c.angle; c.angle = a0 - 7; extra.push(c.fire(this.W, { spin })); c.angle = a0 + 7; extra.push(c.fire(this.W, { spin })); c.angle = a0;
    }
    const n = this.noodle = c.fire(this.W, { spin });
    for (const m of [n, ...extra]) { for (const p of m.list) p.grp = this.grp; this.grp++; this.bodies.push(m); }
    this.extra = extra;
    this.sp = { kind, fuel: 1.6, grabs: 0, grab: null, used: false, ball: null, grip: [] };
    if (kind === 'ball') {
      const a = c.angle * Math.PI / 180, [mx, my] = c.mouth();
      const b = this.W.particle({ x: mx + Math.cos(a) * 0.4, y: my + Math.sin(a) * 0.4, vx: Math.cos(a) * c.power, vy: Math.sin(a) * c.power, r: 0.5, mass: 30, tag: 'iron', grp: -4, sail: 0, fric: 0.3, rest: 0.2, drag: 0.0005 });
      this.sp.ball = b; this.sp.grip = [this.W.stick(n.parts.handL, b, { min: 0, max: 0.6 }), this.W.stick(n.parts.handR, b, { min: 0, max: 0.6 })];
    }
    const [x0] = n.com(); this.judge.start(n, x0, extra);
    this.phase = 'fly'; this.puffs = this.maxPuffs; this.trail = []; this.shotT = 0; this.feedSeen = 0;
    const [mx, my] = c.mouth(); this.emit('boom', { x: mx, y: my, a: c.angle, power: c.power, kind });
    if (kind === 'ball') this.judge.award('ride', 'Baron Munchausen', 80, 'ride', mx, my);
  }
  all() { return this.noodle ? [this.noodle, ...(this.extra || [])] : []; }

  flyControl(inp) {
    const n = this.noodle; if (!n) return;
    const w = n.omega(), want = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);    // left = counter-clockwise
    if (want && (Math.sign(w) * want <= 0 || Math.abs(w) < 15)) n.spin(want * 16 * DT);   // torque up to a spin cap
    const pose = inp.tuck ? 'tuck' : inp.glide ? 'spread' : 'loose';
    for (const m of this.all()) m.setPose(pose);
    this.puffCd -= DT;
    const sp = this.sp;
    // the ammo's special action takes Space first; puffs come after it is spent
    if (sp.kind === 'rocket' && sp.fuel > 0 && (inp.actionH || inp.puffP)) return this.rocket(n, inp);
    if (inp.puffP) {
      if (sp.kind === 'sticky' && sp.grab) return this.release();
      if (sp.kind === 'bomb' && !sp.used) return this.selfDestruct(n, inp);
      if (sp.kind === 'ball' && sp.grip.length) return this.letGo();
      if (this.puffs > 0 && this.puffCd <= 0) {
        const [dx, dy] = this.dir(n, inp);
        for (const m of this.all()) m.push(dx * 7, dy * 7);
        this.puffs--; this.puffCd = 0.25;
        const [cx, cy] = n.com(); this.judge.puff(cx, cy); this.emit('puff', { x: cx, y: cy, dx: -dx, dy: -dy });
      }
    }
  }
  dir(n, inp) {   // where the player wants to go: pointer, arrows, or up-and-onward
    let dx = 0, dy = 0;
    if (inp.puffDir) { const [cx, cy] = n.com(); dx = inp.puffDir.x - cx; dy = inp.puffDir.y - cy; }
    else { dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0); dy = (inp.up ? 1 : 0) - (inp.down ? 1 : 0); }
    if (!dx && !dy) { const [vx] = n.vel(); dx = vx >= 0 ? 0.35 : -0.35; dy = 1; }
    const L = Math.hypot(dx, dy); return [dx / L, dy / L];
  }
  rocket(n, inp) {   // thrust pushes the feet along the body axis: off-centre, so it also tumbles you
    const P = n.parts, ux = P.head.x - (P.footL.x + P.footR.x) / 2, uy = P.head.y - (P.footL.y + P.footR.y) / 2, L = Math.hypot(ux, uy) || 1, a = 95 * DT;
    for (const p of [P.footL, P.footR, P.kneeL, P.kneeR, P.pelvis]) this.W.addVel(p, ux / L * a, uy / L * a);
    this.sp.fuel -= DT; this.rocketT = (this.rocketT || 0) + DT;
    this.emit('flame', { x: (P.footL.x + P.footR.x) / 2, y: (P.footL.y + P.footR.y) / 2, dx: -ux / L, dy: -uy / L });
    if (this.sp.fuel < 1.1) this.judge.award('rocket0', 'Unlicensed Aviation', 120, 'rocket', P.pelvis.x, P.pelvis.y);
    if (this.sp.fuel <= 0) this.judge.award('rocket1', 'Out of Fuel, Full of Regret', 100, 'rocket', P.pelvis.x, P.pelvis.y);
  }
  selfDestruct(n, inp) {
    const [dx, dy] = this.dir(n, inp), [cx, cy] = n.com(); this.sp.used = true;
    this.blast(cx - dx * 0.8, cy - dy * 0.8, 6.5, 26, n);   // blast centre just behind you, so you fly where you pointed
    this.judge.award('bomb', 'Self-Destruct Sequence', 150, 'boom', cx, cy);
  }
  letGo() {
    for (const st of this.sp.grip) this.W.unlink(st); this.sp.grip = [];
    const [cx, cy] = this.noodle.com(); this.judge.award('letgo', 'Dismount', 60, 'ride', cx, cy); this.emit('caption', { text: 'Let go of the cannonball!' });
  }
  // sticky hands: the first hand that touches something grabs it (static ground, a crate corner, another body)
  stickyCheck() {
    const sp = this.sp, n = this.noodle; if (sp.kind !== 'sticky' || sp.grab || sp.grabs >= 2 || this.shotT < 0.15 || sp.cool > 0) { if (sp.cool > 0) sp.cool -= DT; return; }
    for (const h of [n.parts.handL, n.parts.handR]) {
      const c = h.hit; if (!c || !c.other) continue; const o = c.other;
      let target;
      if (o.type) { target = this.W.anchor(h.x - c.nx * h.r, h.y - c.ny * h.r); }
      else if (o.v) { let best = null, bd = 1e9; for (const v of o.v) { const d = Math.hypot(v.x - h.x, v.y - h.y); if (d < bd) { bd = d; best = v; } } target = best; this.W.wake(o); }
      else if (o.im !== undefined) target = o;
      if (!target) continue;
      const d = Math.hypot(target.x - h.x, target.y - h.y);
      sp.grab = { st: this.W.stick(h, target, { min: 0, max: d + 0.05 }), target, hand: h }; sp.grabs++;
      this.judge.award('grab' + sp.grabs, ['Spider-Noodle', 'Second Grab'][sp.grabs - 1], [110, 90][sp.grabs - 1], 'swing', h.x, h.y);
      this.emit('grab', { x: h.x, y: h.y }); this.puffs = Math.max(this.puffs, 1);
      return;
    }
  }
  release() {
    const sp = this.sp, n = this.noodle; this.W.unlink(sp.grab.st); if (sp.grab.target.tag === 'anchor') this.W.kill(sp.grab.target); sp.grab = null; sp.cool = 0.35;
    const [vx, vy] = n.vel(), s = Math.hypot(vx, vy), [cx, cy] = n.com();
    if (s > 3) n.push(vx / s * 3, vy / s * 3 + 1.5);   // a little whip on release
    if (s > 11) this.judge.award('trapeze', 'Trapeze Artist', 160, 'swing', cx, cy);
    this.emit('release', { x: cx, y: cy });
  }

  // ---------- one tick of the world ----------
  stepWorld() {
    const live = this.phase === 'fly' && this.noodle, n = live && !this.noodle.touching() ? this.noodle : null, L0 = n ? n.angular()[0] : 0;
    if (live) { this.lift = 0; for (const m of this.all()) { const l = m.aero(DT); if (m === this.noodle) this.lift = l; m.flail(this.t + m.list[0].grp); } }
    this.W.step(); this.t += DT;
    if (n) n.keepMomentum(L0);
    for (const e of this.W.events) {
      const ours = this.noodle && this.judge.chain && this.judge.chain.mine.has(e.p);
      const o = e.other;
      if (o && o.kick && e.speed > 3) { this.emit('boing', { x: e.x, y: e.y, s: o }); o.flash = 1; }
      else if (e.speed > 7) this.emit('bonk', { x: e.x, y: e.y, speed: e.speed, ours, head: e.p.tag === 'head', iron: e.p.tag === 'iron' });
      if (o && o.v && o.kind === 'tnt' && e.speed > 7) o.fuse = 1;
      if (o && o.kind === 'target' && !o.popped) { o.popped = true; this.popTarget(o); }
      if (o && o.tag === 'balloon' && !o.off) this.popBalloon(o);
      if (e.p.tag === 'balloon' && !e.p.off && o && !o.type) this.popBalloon(e.p);
    }
    this.tntCheck();
    if (live) {
      this.shotT += DT;
      if (this.sp) this.stickyCheck();
      const [cx, cy] = this.noodle.com(); if ((this.W.frame & 1) === 0) { this.trail.push([cx, cy]); if (this.trail.length > 400) this.trail.shift(); }
      this.judge.tick(this.W, DT, { moved: movedCount(this.W), pins: pinsDown(this.W), groundY: (x) => this.groundY(x), lift: this.lift });
      const feed = this.judge.feed; while (this.feedSeen < feed.length) this.emit('trick', feed[this.feedSeen++]);
    }
  }
  popTarget(s) { const i = this.W.S.indexOf(s); if (i >= 0) this.W.S.splice(i, 1); this.judge.target(s.id, s.label || 'Balloon Pop!', s.pts || 150, s.x, s.y); this.emit('pop', { x: s.x, y: s.y, color: s.color }); }
  popBalloon(b) { this.emit('pop', { x: b.x, y: b.y, color: b.color }); this.judge.target('bal' + b.x.toFixed(1), 'Sky Crate Delivery', 130, b.x, b.y); this.W.kill(b); }
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
    this.W.C = this.W.C.filter(c => !q.v.includes(c.a) && !q.v.includes(c.b)); this.W.Q.splice(this.W.Q.indexOf(q), 1);
    this.blast(x, y, 5.5, 22);
    if (this.judge.chain) this.judge.target('tnt-' + q.id, 'KABOOM', 200, x, y);
  }
  blast(x, y, R, power, self) {
    for (const o of this.W.Q) { const [ox, oy] = centre(o); if (Math.hypot(ox - x, oy - y) < R + 1) this.W.wake(o); }
    for (const p of this.W.P) {
      if (p.off || p.im === 0) continue; const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy); if (d > R || d < 1e-6) continue;
      const k = power * (1 - d / R) * (self && self.list.includes(p) ? 0 : 1); this.W.addVel(p, dx / d * k, dy / d * k + k * 0.3);
      if (p.tag === 'balloon') this.W.kill(p);
    }
    if (self) { const [cx, cy] = self.com(), dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy) || 1; self.push(dx / d * power * 0.85, dy / d * power * 0.85); }
    this.emit('kaboom', { x, y });
  }
}
export { centre, Noodle };
