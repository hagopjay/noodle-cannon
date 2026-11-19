// sim: Concept A — LAUNCH PARTY. Five shots into one seeded field of towers, TNT, bumpers and balloons.
// Damage persists between shots, so every shot changes the playground for the next one.
import { Mode, DT } from './base.js';
import { Cannon } from '../noodle.js';
import { TOYS, resetIds } from '../toys.js';

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
    resetIds();
    let x = 16; const kinds = ['tower', 'tower', 'pyramid', 'bumper', 'tramp', 'balloons', 'ramp', 'fort', 'fan', 'pendulum', 'seesaw', 'bridge', 'pins', 'skycrate', 'tower'];
    let last = '';
    while (x < this.length - 14) {
      let k = kinds[Math.floor(r() * kinds.length)]; if (k === last && k !== 'tower') k = 'tower'; last = k;
      const used = TOYS[k](W, x, 0, r); x += used + 5 + r() * 7;
    }
    this.inv = { noodle: Infinity, triple: 1, sticky: 1, rocket: 1, bomb: 1, ball: 1 };
    this.settle();
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
      if ((c && c.still > 0.8 && !(this.sp && this.sp.grab)) || this.shotT > 14 || cy < -20 || inp.skipP) this.endShot();
    }
    this.stepWorld();
    if (this.cannon) { this.cannon.recoil *= 0.88; this.cannon.flash *= 0.8; }
  }
  endShot() {
    if (this.sp && this.sp.grab) this.release(); const r = this.judge.finish(); this.shot++;
    if (!(this.inv[this.ammo] > 0)) this.ammo = 'noodle'; this.total += r.score; this.results.push(r);
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
