// sim: Concept A — LAUNCH PARTY. Five shots into one seeded field of towers, TNT, bumpers and balloons.
// Damage persists between shots, so every shot changes the playground for the next one.
import { Mode, DT } from './base.js';
import { Cannon } from '../noodle.js';

export class LaunchParty extends Mode {
  static id = 'launch';
  static title = 'Launch Party';
  constructor(seed) {
    super(seed); const r = this.rnd, W = this.W;
    this.theme = 'carnival'; this.shots = 5; this.shot = 0; this.total = 0; this.results = []; this.done = false; this.length = 230;
    W.poly([[-40, 0], [this.length + 40, 0], [this.length + 40, -8], [-40, -8]], { id: 'ground', kind: 'ground' });
    W.poly([[-3, 0], [3, 0], [2.4, 0.5], [-2.4, 0.5]], { id: 'plinth', kind: 'stone' });
    W.poly([[this.length + 30, 0], [this.length + 32, 0], [this.length + 32, 30], [this.length + 30, 30]], { id: 'backstop', kind: 'stone' });
    this.cannon = new Cannon(0, 1.3, { angle: 32, power: 26, minP: 10, maxP: 44 });
    let x = 16; const kinds = ['tower', 'tower', 'pyramid', 'bumper', 'tramp', 'balloons', 'ramp', 'fort'];
    let qid = 0; const crate = (cx, cy, o = {}) => W.quad(Object.assign({ x: cx, y: cy, w: 0.5, h: 0.5, id: 'c' + qid++, asleep: true }, o));
    const tnt = (cx, cy) => crate(cx, cy, { kind: 'tnt', mass: 0.8 });
    let bal = 0;
    while (x < this.length - 12) {
      const k = kinds[Math.floor(r() * kinds.length)];
      if (k === 'tower') {
        const hgt = 3 + Math.floor(r() * 5), cols = 1 + Math.floor(r() * 2);
        for (let c = 0; c < cols; c++) for (let i = 0; i < hgt; i++) (r() < 0.12 ? tnt : crate)(x + c * 1.0, 0.5 + i * 1.0);
        if (r() < 0.6) crate(x + (cols - 1) * 0.5, 0.5 + hgt * 1.0 + 0.15, { w: 1.4, h: 0.15, kind: 'plank', mass: 0.6 });
        x += cols + 5 + r() * 8;
      } else if (k === 'pyramid') {
        const b = 3 + Math.floor(r() * 3);
        for (let row = 0; row < b; row++) for (let i = 0; i < b - row; i++) (r() < 0.1 ? tnt : crate)(x + i * 1.02 + row * 0.51, 0.5 + row * 1.0);
        x += b + 6 + r() * 6;
      } else if (k === 'fort') {   // two pillars, a plank roof, a TNT inside: hit the roof, set it off
        crate(x, 0.5); crate(x, 1.5); crate(x + 3, 0.5); crate(x + 3, 1.5);
        crate(x + 1.5, 2.15, { w: 2.2, h: 0.15, kind: 'plank', mass: 0.8 }); tnt(x + 1.5, 0.5);
        crate(x + 1.5, 2.8, { w: 0.5, h: 0.5 });
        x += 9 + r() * 6;
      } else if (k === 'bumper') {
        const by = 3 + r() * 7; W.circle(x, by, 0.75, { kick: 15 + r() * 6, kind: 'bumper', id: 'bump' + x.toFixed(0), rest: 0.9 }); x += 7 + r() * 8;
      } else if (k === 'tramp') {
        W.poly([[x - 1.6, 0], [x + 1.6, 0], [x + 1.6, 0.35], [x - 1.6, 0.35]], { kick: 17 + r() * 4, kind: 'tramp', id: 'tramp' + x.toFixed(0), rest: 0.85, fric: 0.2 }); x += 8 + r() * 6;
      } else if (k === 'balloons') {
        const n = 2 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) { const s = W.circle(x + i * 1.6, 4 + r() * 8, 0.55, { kind: 'target', id: 'bal' + bal++ }); s.label = 'Balloon Pop!'; s.pts = 120; s.color = ['#ff5d8f', '#ffd23f', '#4fd1ff', '#9b7bff'][i % 4]; }
        x += n * 1.6 + 6 + r() * 6;
      } else if (k === 'ramp') {
        const L = 4 + r() * 3, H = 1 + r() * 1.4; W.poly([[x, 0], [x + L, 0], [x + L, H]], { kind: 'stone', id: 'ramp' + x.toFixed(0), fric: 0.25 }); x += L + 6 + r() * 6;
      }
    }
    // distance flags every 25 m
    this.flags = []; for (let d = 25; d < this.length; d += 25) this.flags.push(d);
    this.hint = 'Aim: mouse, or W/S + A/D. Fire: click or Space.';
  }
  groundY() { return 0; }
  tick(inp) {
    if (this.phase === 'aim' && !this.done) this.aimControl(inp);
    else if (this.phase === 'fly') {
      this.flyControl(inp);
      const c = this.judge.chain, [cx, cy] = this.noodle.com();
      if ((c && c.still > 0.8) || this.shotT > 14 || cy < -20 || inp.skipP) this.endShot();
    }
    this.stepWorld();
    if (this.cannon) { this.cannon.recoil *= 0.88; this.cannon.flash *= 0.8; }
  }
  endShot() {
    const r = this.judge.finish(); this.shot++; this.total += r.score; this.results.push(r);
    this.emit('shot', { result: r, shot: this.shot }); this.phase = 'aim'; this.noodle = null;
    if (this.shot >= this.shots) { this.done = true; this.phase = 'done'; this.emit('round', { total: this.total, results: this.results }); }
  }
  hud() {
    return { left: `Shot ${Math.min(this.shot + 1, this.shots)} / ${this.shots}`, score: this.total + (this.judge.chain ? this.judge.chain.score : 0),
      sub: this.judge.chain ? `chain ${this.judge.chain.score} ×${this.judge.chain.mult}` : 'total' };
  }
  camTarget() {
    if (this.phase === 'fly' && this.noodle) { const [x, y] = this.noodle.com(), [vx] = this.noodle.vel(); return [x + vx * 0.25, Math.max(y, 4), 1]; }
    return [this.cannon.x + 9, 5, 1];
  }
}
