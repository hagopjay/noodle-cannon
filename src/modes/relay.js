// sim: Concept B — BARREL RELAY. Endless chain of cannons over the sea. Each cannon catches the noodle;
// swivelling, swinging and sliding cannons make the fire button a timing game. Fall in the sea and the run ends.
import { Mode, DT } from './base.js';
import { Cannon } from '../noodle.js';

const SEA = -6;

export class BarrelRelay extends Mode {
  static id = 'relay';
  static title = 'Barrel Relay';
  constructor(seed) {
    super(seed); const W = this.W;
    this.theme = 'sea'; this.maxPuffs = 2; this.hops = 0; this.total = 0; this.streak = 0; this.done = false;
    this.cannons = []; this.stars = []; this.loaded = null; this.wait = 0; this.best = 0;
    W.poly([[-12, -1], [4, -1], [4, -12], [-12, -12]], { id: 'dock', kind: 'stone' });
    const c0 = new Cannon(0, 0, { angle: 40, power: 18, id: 'k0' }); c0.type = 'start'; c0.base = [0, 0];
    this.cannons.push(c0); this.cannon = c0; this.loaded = c0;
    while (this.cannons.length < 8) this.extend();
    this.hint = 'Space or click to fire. Reach the next cannon. ←/→ spin, ↓ tuck, ↑ or click puffs.';
  }
  // place the next cannon and give the previous one the power that would land the noodle in it
  extend() {
    const r = this.rnd, prev = this.cannons[this.cannons.length - 1], i = this.cannons.length;
    const hard = Math.min(1, i / 30);
    const dx = 9 + r() * (6 + 8 * hard), dy = (r() - 0.45) * (4 + 6 * hard);
    const ny = Math.max(SEA + 3, Math.min(14, prev.base[1] + dy)), nx = prev.base[0] + dx;
    const types = i < 3 ? ['fixed'] : ['fixed', 'swivel', 'swivel', 'swing', 'slide', 'blast'];
    const c = new Cannon(nx, ny, { id: 'k' + i, minP: 6, maxP: 40 }); c.base = [nx, ny];
    c.type = types[Math.floor(r() * types.length)]; c.phase = r() * Math.PI * 2; c.per = 1.4 + r() * 1.4 - hard * 0.4;
    c.a0 = 25 + r() * 35; c.angle = c.a0; c.sweep = 22 + r() * 18; c.swingL = 3 + r() * 2; c.slide = 1.5 + r() * 2.5;
    this.cannons.push(c);
    this.solve(prev, c);
    // stars along the expected arc, worth a detour
    if (r() < 0.7) { const t = 0.35 + r() * 0.3, [mx, my] = prev.mouth(), a = prev.angle * Math.PI / 180, T = this.flightT(prev, c);
      this.stars.push({ x: mx + Math.cos(a) * prev.power * T * t, y: my + Math.sin(a) * prev.power * T * t + 0.5 * this.W.g * (T * t) ** 2 + 1.2 + r() * 1.5, got: false }); }
  }
  flightT(a, b) { const ang = a.angle * Math.PI / 180, [mx] = a.mouth(); return (b.base[0] - mx) / (Math.cos(ang) * a.power || 1); }
  solve(a, b) {   // speed that carries a drag-free point from a's mouth (at its mean angle) to b
    const ang = (a.type === 'swivel' ? a.a0 : a.angle) * Math.PI / 180, ca = Math.cos(ang), [mx, my] = [a.base[0] + ca * a.len, a.base[1] + Math.sin(ang) * a.len];
    const dx = b.base[0] - mx, dy = b.base[1] - my, den = 2 * ca * ca * (dx * Math.tan(ang) - dy);
    a.power = den > 0 ? Math.min(40, Math.sqrt(-this.W.g * dx * dx / den) * 1.03) : 30;   // +3 % for air drag on a limp body
    a.maxP = a.minP = a.power;
  }
  move(c, t) {
    const w = (2 * Math.PI) / c.per, s = Math.sin(t * w + c.phase);
    if (c.type === 'swivel') c.angle = c.a0 + s * c.sweep;
    else if (c.type === 'swing') { const th = s * 0.5; c.x = c.base[0] + Math.sin(th) * c.swingL; c.y = c.base[1] + c.swingL - Math.cos(th) * c.swingL; c.angle = c.a0 + th * 30; }
    else if (c.type === 'slide') c.y = c.base[1] + s * c.slide;
  }
  groundY() { return SEA; }
  tick(inp) {
    for (const c of this.cannons) this.move(c, this.t);
    if (this.phase === 'aim') {
      const c = this.loaded; this.wait += DT;
      if (c.type === 'blast' && this.wait > 0.45) this.launch(c);
      else if ((inp.fireP || inp.puffP) && this.wait > 0.15) this.launch(c);
      else if (this.wait > 4) { this.launch(c); this.emit('caption', { text: 'Too slow — the cannon got bored.' }); }
    } else if (this.phase === 'fly') {
      if (this.shotT > 0.1) this.flyControl(Object.assign({}, inp, { puffP: inp.puffP || inp.fireP }));
      const n = this.noodle, [cx, cy] = n.com();
      for (const s of this.stars) if (!s.got && Math.hypot(s.x - cx, s.y - cy) < 1.4) { s.got = true; this.total += 50; this.emit('star', { x: s.x, y: s.y }); this.judge.target('star' + s.x.toFixed(1), 'Shiny!', 60, s.x, s.y); }
      for (const c of this.cannons) {
        if (c === this.loaded || c.used) continue;
        if (n.list.some(p => Math.hypot(p.x - c.x, p.y - c.y) < 1.5)) { this.catch(c); break; }
      }
      if (this.phase === 'fly' && (cy < SEA || (this.judge.chain && this.judge.chain.still > 1.2) || this.shotT > 9)) this.splash();
    }
    if (this.phase !== 'done' || this.noodle) this.stepWorld();
    for (const c of this.cannons) { c.recoil *= 0.88; c.flash *= 0.8; }
  }
  launch(c) { this.fire(c); c.used = true; this.wait = 0; }
  catch(c) {
    const r = this.judge.finish(); this.hops++; this.streak++;
    const pts = 100 + r.score; this.total += pts; this.noodle.remove(); this.noodle = null;
    this.loaded = c; this.cannon = c; this.phase = 'aim'; this.wait = 0;
    this.emit('catch', { x: c.x, y: c.y, pts, hop: this.hops, result: r });
    while (this.cannons.length < this.hops + 8) this.extend();
  }
  splash() {
    const [cx] = this.noodle.com(); this.judge.finish(); this.phase = 'done'; this.done = true;
    this.emit('splash', { x: cx, y: SEA }); this.emit('round', { total: this.total, hops: this.hops });
  }
  hud() { return { left: `Cannons ${this.hops}`, score: this.total + (this.judge.chain ? this.judge.chain.score : 0), sub: this.judge.chain ? `hop chain ${this.judge.chain.score} ×${this.judge.chain.mult}` : (this.loaded ? this.loaded.type + ' cannon' : '') }; }
  camTarget() {
    if (this.phase === 'fly' && this.noodle) { const [x, y] = this.noodle.com(); return [x + 3, y, 1.05]; }
    const c = this.loaded, nx = this.cannons[this.cannons.indexOf(c) + 1] || c; return [(c.x + nx.x) / 2, (c.y + nx.y) / 2 + 1, 1.05];
  }
}
