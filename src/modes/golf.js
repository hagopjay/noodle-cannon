// sim: Concept C — FLOP GOLF. The cannon is your club and the noodle is your ball. Fire, watch it tumble,
// the cannon rolls to wherever the noodle stopped, fire again. Sink the noodle in the cup in as few shots as possible.
import { Mode, DT } from './base.js';
import { Cannon } from '../noodle.js';
import { World } from '../engine.js';

export class FlopGolf extends Mode {
  static id = 'golf';
  static title = 'Flop Golf';
  constructor(seed) {
    super(seed); this.theme = 'meadow'; this.holes = 3; this.hole = 0; this.strokes = 0; this.card = []; this.done = false;
    this.build();
  }
  build() {
    const r = this.rnd; this.W = new World(); const W = this.W;
    this.bodies = []; this.noodle = null; this.strokes = 0; this.phase = 'aim'; this.holed = 0;
    const L = 60 + Math.floor(r() * 45) + this.hole * 10; this.L = L;
    const cup = L - 6; this.cup = { x0: cup - 1.6, x1: cup + 1.6, y: 0, depth: 1.6 };
    const a1 = 1 + r() * 3, a2 = 0.5 + r() * 1.5, f1 = 0.05 + r() * 0.05, f2 = 0.15 + r() * 0.1, p1 = r() * 6, p2 = r() * 6;
    const hill = (x) => a1 * Math.sin(x * f1 + p1) + a2 * Math.sin(x * f2 + p2);
    // hazards: water and sand spans
    this.water = null; this.sand = null;
    if (r() < 0.7) { const w0 = 18 + r() * (L * 0.45); this.water = { x0: w0, x1: w0 + 5 + r() * 5 }; }
    if (r() < 0.7) { const s0 = cup - 14 - r() * 10; this.sand = { x0: s0, x1: s0 + 5 + r() * 3 }; }
    const ground = (x) => {
      let y = hill(x) - hill(0);
      if (x < 6) y = 0;
      const near = Math.max(0, 1 - Math.abs(x - cup) / 8), yc = hill(cup) - hill(0); y = y * (1 - near) + yc * near;   // the green flattens around the cup
      if (this.water && x > this.water.x0 && x < this.water.x1) y -= 2.2 * Math.sin(Math.PI * (x - this.water.x0) / (this.water.x1 - this.water.x0));
      return y;
    };
    this.groundFn = ground;
    this.cup.y = ground(cup);
    const step = 1.5, pts = [];
    for (let x = -12; x <= L + 14; x += step) {
      if (x > this.cup.x0 - step && x < this.cup.x1 + step) continue;
      pts.push(x);
    }
    const seg = (xa, xb, kind, fric) => { const ya = ground(xa), yb = ground(xb); W.poly([[xa, ya], [xb, yb], [xb, -25], [xa, -25]], { kind, fric, id: kind + xa.toFixed(1) }); };
    for (let i = 0; i < pts.length - 1; i++) {
      const xa = pts[i], xb = pts[i + 1]; if (xb - xa > step + 0.01) continue;
      const mid = (xa + xb) / 2, sand = this.sand && mid > this.sand.x0 && mid < this.sand.x1;
      seg(xa, xb, sand ? 'sand' : 'grass', sand ? 2.2 : 0.7);
    }
    // the cup: a pit with a floor and walls joining the green on both sides
    const cy = this.cup.y, lx = pts.filter(x => x < cup).pop(), rx = pts.find(x => x > cup);
    W.poly([[lx, ground(lx)], [this.cup.x0, cy], [this.cup.x0, -25], [lx, -25]], { kind: 'grass', id: 'lip-l' });
    W.poly([[this.cup.x1, cy], [rx, ground(rx)], [rx, -25], [this.cup.x1, -25]], { kind: 'grass', id: 'lip-r' });
    W.poly([[this.cup.x0, cy - this.cup.depth], [this.cup.x1, cy - this.cup.depth], [this.cup.x1, -25], [this.cup.x0, -25]], { kind: 'cup', id: 'cup-floor', fric: 1.2, rest: 0 });
    W.poly([[L + 13, -5], [L + 14, -5], [L + 14, 30], [L + 13, 30]], { kind: 'stone', id: 'wall' });
    // obstacles between tee and cup
    this.mills = [];
    const nObs = 1 + Math.floor(r() * 2) + this.hole;
    for (let k = 0; k < nObs; k++) {
      const x = 16 + r() * (L - 30), y = ground(x); if (this.water && x > this.water.x0 - 2 && x < this.water.x1 + 2) continue; if (Math.abs(x - cup) < 6) continue;
      const kind = ['wall', 'mill', 'bumper', 'mill'][Math.floor(r() * 4)];
      if (kind === 'wall') { const h = 2 + Math.floor(r() * 3); for (let i = 0; i < h; i++) W.quad({ x, y: y + 0.5 + i, w: 0.5, h: 0.5, asleep: true, id: 'w' + k + i }); }
      else if (kind === 'bumper') W.circle(x, y + 3 + r() * 3, 0.8, { kick: 14, kind: 'bumper', id: 'b' + k, rest: 0.9 });
      else { const m = W.quad({ x, y: y + 4, w: 2.6, h: 0.18, kin: true, kind: 'mill', id: 'mill' + k }); m.cx = x; m.cy = y + 4; m.w8 = (r() < 0.5 ? -1 : 1) * (1.2 + r() * 1.4); W.circle(x, y + 4, 0.25, { kind: 'peg', id: 'hub' + k }); this.mills.push(m); }
    }
    W.pre = (t) => { for (const m of this.mills) { const a = t * m.w8, c = Math.cos(a), s = Math.sin(a); const loc = [[-m.w, -m.h], [m.w, -m.h], [m.w, m.h], [-m.w, m.h]];
      m.v.forEach((p, i) => { p.px = p.x; p.py = p.y; p.x = m.cx + loc[i][0] * c - loc[i][1] * s; p.y = m.cy + loc[i][0] * s + loc[i][1] * c; }); } };
    this.par = 2 + Math.round(L / 45) + (this.water ? 1 : 0);
    this.cannon = new Cannon(0, 1.1, { angle: 45, power: 20, minP: 5, maxP: 34, maxA: 175 });   // can shoot back if you overshoot
    this.tee = [0, 1.1]; this.last = [0, 1.1];
    this.hint = 'Sink the noodle in the cup. Aim with mouse or W/S + A/D. Fire: click/Space.';
  }
  groundY(x) { return this.groundFn(x); }
  inCup(n) {   // any torso part below the rim, or the centre of mass over the hole and at rim height (it is going in)
    const k = this.cup, [cx, cy] = n.com(), inX = (x) => x > k.x0 && x < k.x1;
    return [n.parts.pelvis, n.parts.chest].some(b => inX(b.x) && b.y < k.y - 0.15) || (inX(cx) && cy < k.y + 0.25);
  }
  tick(inp) {
    if (this.phase === 'aim') this.aimControl(inp);
    else if (this.phase === 'fly') {
      this.flyControl(inp);
      const n = this.noodle, [cx, cy] = n.com(), ch = this.judge.chain;
      if (this.inCup(n)) { this.holed += DT; if (this.holed > 0.5) return this.sink(); } else this.holed = 0;
      if (this.water && cx > this.water.x0 && cx < this.water.x1 && cy < this.groundFn(this.water.x0) - 0.3) return this.penalty('Splash! +1 stroke');
      if (cx < -12 || cx > this.L + 13 || cy < -15) return this.penalty('Out of bounds! +1 stroke');
      if ((ch && ch.still > 0.6) || this.shotT > 12) this.rest();
    } else if (this.phase === 'between') { this.wait -= DT; if (this.wait <= 0 || inp.fireP) this.nextHole(); }
    this.stepWorld();
    this.cannon.recoil *= 0.88; this.cannon.flash *= 0.8;
  }
  fire() { super.fire(); this.strokes++; this.emit('stroke', { n: this.strokes }); }
  rest() {   // the cannon rolls to where the noodle came to rest
    const r = this.judge.finish(), n = this.noodle, k = this.cup;
    let x = Math.max(-8, Math.min(this.L + 10, n.parts.pelvis.x));
    if (x > k.x0 - 0.8 && x < k.x1 + 0.8) x = x < (k.x0 + k.x1) / 2 ? k.x0 - 0.8 : k.x1 + 0.8;   // never park the cannon over the hole
    n.remove(); this.noodle = null; this.phase = 'aim';
    this.last = [x, this.groundFn(x) + 1.1]; this.cannon.x = x; this.cannon.y = this.last[1];
    const toward = (k.x0 + k.x1) / 2 > x; if (toward !== this.cannon.angle < 90) this.cannon.angle = 180 - this.cannon.angle;   // face the flag
    this.emit('rest', { x, result: r });
  }
  penalty(why) {
    this.judge.finish(); this.noodle.remove(); this.noodle = null; this.strokes++; this.phase = 'aim';
    this.cannon.x = this.last[0]; this.cannon.y = this.last[1]; this.emit('caption', { text: why }); this.emit('splash', { x: this.cannon.x, y: this.cannon.y });
  }
  sink() {
    const r = this.judge.finish(), d = this.strokes - this.par;
    const name = this.strokes === 1 ? 'HOLE IN ONE!' : d <= -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : `+${d}`;
    this.card.push({ hole: this.hole + 1, par: this.par, strokes: this.strokes, name, style: r.score });
    this.emit('sink', { x: (this.cup.x0 + this.cup.x1) / 2, y: this.cup.y, name, strokes: this.strokes });
    this.phase = 'between'; this.wait = 3.5;
  }
  nextHole() {
    this.hole++;
    if (this.hole >= this.holes) { this.phase = 'done'; this.done = true; const tot = this.card.reduce((a, c) => a + c.strokes, 0), par = this.card.reduce((a, c) => a + c.par, 0); this.emit('round', { total: tot, par, card: this.card }); this.hole--; return; }
    this.build(); this.emit('newhole', { hole: this.hole + 1 });
  }
  hud() { const tot = this.card.reduce((a, c) => a + c.strokes, 0); return { left: `Hole ${this.hole + 1} / ${this.holes} · Par ${this.par}`, score: `${this.strokes}`, sub: `strokes · card ${tot}` }; }
  camTarget() {
    if (this.phase === 'fly' && this.noodle) { const [x, y] = this.noodle.com(); return [x + 2, Math.max(y, this.groundFn(x) + 3), 1]; }
    if (this.phase === 'between') return [(this.cup.x0 + this.cup.x1) / 2, this.cup.y + 2, 1.3];
    return [this.cannon.x + 10, this.cannon.y + 4, 0.85];
  }
}
