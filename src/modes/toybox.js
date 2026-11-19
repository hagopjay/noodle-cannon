// sim: Concept E — TOY BOX. Endless shots, every ammo, and you place the toys yourself.
import { Mode, DT } from './base.js';
import { Cannon } from '../noodle.js';
import { TOYS, TOY_LIST, resetIds } from '../toys.js';

export class ToyBox extends Mode {
  static id = 'toybox';
  static title = 'Toy Box';
  constructor(seed) {
    super(seed); this.theme = 'carnival'; this.length = 160; this.total = 0; this.shots = 0; this.best = 0; this.toy = 'tower';
    this.build(true);
    this.hint = 'Sandbox: every ammo, forever. Pick a toy, then right-click or T to drop it. X clears the field.';
  }
  build(starter) {
    const W = this.W; resetIds();
    W.S.length = 0; W.Q.length = 0; W.P.length = 0; W.C.length = 0; W.fields.length = 0; W.ropes.length = 0; this.bodies = []; this.noodle = null;
    W.poly([[-40, 0], [this.length + 40, 0], [this.length + 40, -8], [-40, -8]], { id: 'ground', kind: 'ground' });
    W.poly([[-3, 0], [3, 0], [2.4, 0.5], [-2.4, 0.5]], { id: 'plinth', kind: 'stone' });
    this.cannon = new Cannon(0, 1.3, { angle: 30, power: 26, minP: 8, maxP: 48, maxA: 89 });
    if (starter) { const r = this.rnd; TOYS.pins(W, 22, 0, r); TOYS.fan(W, 34, 0, r); TOYS.tower(W, 44, 0, r, { h: 6, cols: 2 }); TOYS.seesaw(W, 56, 0, r); TOYS.skycrate(W, 66, 0, r); TOYS.pendulum(W, 78, 0, r); TOYS.bridge(W, 88, 0, r); TOYS.fort(W, 104, 0, r); }
    this.inv = { noodle: Infinity, triple: Infinity, sticky: Infinity, rocket: Infinity, bomb: Infinity, ball: Infinity };
    this.settle(60);
  }
  place(x) { if (x < 6) return; TOYS[this.toy](this.W, x, 0, this.rnd); this.emit('placed', { x, toy: this.toy }); }
  groundY() { return 0; }
  tick(inp) {
    if (inp.place !== undefined) this.place(inp.place);
    if (inp.toy) this.toy = inp.toy;
    if (inp.clear) { this.judge.finish(); this.build(false); this.phase = 'aim'; this.emit('caption', { text: 'Field cleared' }); }
    if (this.phase === 'aim') this.aimControl(inp);
    else if (this.phase === 'fly') {
      this.flyControl(inp);
      const c = this.judge.chain, [, cy] = this.noodle.com();
      if ((c && c.still > 0.8 && !(this.sp && this.sp.grab)) || this.shotT > 20 || cy < -20 || inp.skipP) {
        if (this.sp && this.sp.grab) this.release();
        const r = this.judge.finish(); this.shots++; this.total += r.score; this.best = Math.max(this.best, r.score);
        this.emit('shot', { result: r, shot: this.shots }); this.phase = 'aim'; this.noodle = null;
        while (this.bodies.length > 8) { const old = this.bodies.shift(); for (const p of old.list) this.W.kill(p); }
      }
    }
    this.stepWorld();
    this.cannon.recoil *= 0.88; this.cannon.flash *= 0.8;
  }
  hud() { return { left: `Shot ${this.shots + 1} · toy: ${this.toy}`, score: this.judge.chain ? this.judge.chain.score : this.best, sub: this.judge.chain ? `chain ×${this.judge.chain.mult}` : 'best shot' }; }
  camTarget() {
    if (this.phase === 'fly' && this.noodle) { const [x, y] = this.noodle.com(), [vx] = this.noodle.vel(); return [x + vx * 0.25, Math.max(y, 4), 1]; }
    return [this.cannon.x + 9, 5, 1];
  }
}
export { TOY_LIST, DT };
