// sim: Concept D — NOODLE SIEGE. Two forts, three crowned kings each, one cannon each, wind that changes every turn.
// Take turns (against the CPU or a friend on the same screen). Knock all three enemy kings to the ground to win.
import { Mode, DT, centre } from './base.js';
import { Cannon } from '../noodle.js';
import { TOYS, crate, resetIds } from '../toys.js';

const FIELD = 66;

export class NoodleSiege extends Mode {
  static id = 'siege';
  static title = 'Noodle Siege';
  constructor(seed, opt = {}) {
    super(seed); const W = this.W, r = this.rnd; resetIds();
    this.theme = 'dusk'; this.cpu = opt.players !== 2; this.demo = !!opt.demo; this.turn = 0;   // demo: the CPU plays both sides
    this.player = 0; this.done = false; this.winner = -1; this.length = FIELD;
    W.poly([[-30, 0], [FIELD + 30, 0], [FIELD + 30, -8], [-30, -8]], { id: 'ground', kind: 'ground' });
    // a hill in the middle so flat shots do not work
    const hh = this.hillH = 3 + r() * 3; W.poly([[FIELD / 2 - 9, 0], [FIELD / 2 + 9, 0], [FIELD / 2 + 3, hh], [FIELD / 2 - 3, hh]], { id: 'hill', kind: 'stone' });
    for (const [side, x0] of [[0, 7], [1, FIELD - 13.8]]) this.fort(side, x0);
    const mid = ['pendulum', 'skycrate', 'bumper', 'fan', 'balloons'];
    for (const x of [24, FIELD - 26]) TOYS[mid[Math.floor(r() * mid.length)]](W, x, 0, r);
    // each cannon sits on a rock behind its own fort, so a flat shot clears your own walls
    W.poly([[-6, 0], [4, 0], [3.4, 4.2], [-6, 4.2]], { id: 'rockL', kind: 'stone' }); W.poly([[FIELD - 4, 0], [FIELD + 6, 0], [FIELD + 6, 4.2], [FIELD - 3.4, 4.2]], { id: 'rockR', kind: 'stone' });
    this.cannons = [new Cannon(1.5, 5.5, { angle: 45, power: 26, minP: 10, maxP: 40, id: 'p1' }), new Cannon(FIELD - 1.5, 5.5, { angle: 135, power: 26, minP: 10, maxP: 40, minA: 95, maxA: 175, id: 'p2' })];
    this.cannon = this.cannons[0];
    this.invs = [0, 1].map(() => ({ noodle: Infinity, triple: 2, sticky: 1, rocket: 1, bomb: 1, ball: 1 }));
    this.inv = this.invs[0]; this.style = [0, 0]; this.ais = [{ k: 1 }, { k: 1 }]; this.ai = this.ais[0];
    this.newWind(); this.settle(200);
    this.hint = this.cpu ? 'Knock all three enemy kings off their thrones. You fire from the left.' : 'Two players: take turns. Knock all three enemy kings off their thrones.';
  }
  fort(side, x0) {   // three crate columns, a crowned king on top of each, and a low front wall
    const W = this.W, r = this.rnd, kings = [];
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * 3.4, h = 2 + Math.floor(r() * 3);   // two-crate-wide columns, spaced so one hit does not domino the lot
      for (let j = 0; j < h; j++) { crate(W, x - 0.5, 0.5 + j, { mass: 1.6 }); crate(W, x + 0.5, 0.5 + j, { mass: 1.6 }); }
      const k = crate(W, x, h + 0.5, { kind: 'king', mass: 4, id: `king${side}${i}` }); k.side = side; kings.push(k);
    }
    const wx = side ? x0 - 2.5 : x0 + 9.5; for (let j = 0; j < 4; j++) crate(W, wx, 0.5 + j, { mass: 2 });
    (this.kings || (this.kings = []))[side] = kings;
  }
  newWind() { this.wind = Math.round((this.rnd() * 2 - 1) * 6 * 10) / 10; this.W.wind = this.wind; }
  alive(side) { return this.kings[side].filter(k => !k.down); }
  checkKings() {
    for (const side of [0, 1]) for (const k of this.kings[side]) {
      if (k.down) continue; const [x, y] = centre(k);
      if (y < Math.max(k.y0 - 1.5, 0.8) || Math.abs(x - k.x0) > 4 || !this.W.Q.includes(k))   /* knocked off the throne */ { k.down = true; this.emit('kingdown', { x, y, side, by: this.player }); if (this.judge.chain && side !== this.player) this.judge.target(k.id, 'REGICIDE', 500, x, y); }
    }
  }
  tick(inp) {
    if (this.phase === 'aim') {
      if (this.isCpu()) this.cpuAim(); else this.aimControl(inp);
    } else if (this.phase === 'fly') {
      if (!this.isCpu()) this.flyControl(inp); else this.cpuFly();
      const c = this.judge.chain;
      if ((c && c.still > 0.9 && !(this.sp && this.sp.grab)) || this.shotT > 11 || (inp.skipP && !this.isCpu())) { if (this.sp && this.sp.grab) this.release(); this.phase = 'settle'; this.wait = 0; const r = this.judge.finish(); this.style[this.player] += r.score; this.lastResult = r; }
    } else if (this.phase === 'settle') {
      this.wait += DT; const moving = this.W.Q.some(q => !q.asleep && !q.kin && Math.hypot(q.v[0].vx0, q.v[0].vy0) > 0.5);
      if ((this.wait > 0.7 && !moving) || this.wait > 4) this.endTurn();
    }
    this.stepWorld(); this.checkKings();
    for (const c of this.cannons) { c.recoil *= 0.88; c.flash *= 0.8; }
  }
  endTurn() {
    const a = this.alive(0).length, b = this.alive(1).length;
    if (!a || !b) { this.done = true; this.phase = 'done'; this.winner = !b && a ? 0 : !a && b ? 1 : this.player; this.emit('round', { winner: this.winner, cpu: this.cpu, turns: this.turn + 1, style: this.style }); return; }
    if (this.noodle) this.noodle = null;
    while (this.bodies.length > 6) { const old = this.bodies.shift(); for (const p of old.list) this.W.kill(p); }
    this.turn++; this.player = 1 - this.player; this.cannon = this.cannons[this.player]; this.inv = this.invs[this.player];
    if (!(this.inv[this.ammo] > 0)) this.ammo = 'noodle';
    this.newWind(); this.phase = 'aim'; this.cpuT = 0;
    this.emit('turn', { player: this.player, wind: this.wind, cpu: this.isCpu() });
  }
  // point-mass forecast of a limp noodle: gravity, wind on its sail, quadratic drag. Returns null if it hits the hill first.
  predict(c, ang, v, tx) {
    const a = ang * Math.PI / 180, sg = this.player ? -1 : 1, k = 0.004, dt = 1 / 60;
    let x = c.x + sg * Math.cos(a) * c.len, y = c.y + Math.sin(a) * c.len, vx = sg * Math.cos(a) * v, vy = Math.sin(a) * v;
    for (let i = 0; i < 600; i++) {
      const sp = Math.hypot(vx, vy); vx += (this.W.wind - k * sp * vx) * dt; vy += (this.W.g - k * sp * vy) * dt; x += vx * dt; y += vy * dt;
      const hx = Math.abs(x - FIELD / 2); if (hx < 9 && y < this.hillH * Math.min(1, (9 - hx) / 6) + 0.8) return null;
      if ((x - tx) * sg >= 0) return y;   // height when it reaches the king's x
      if (y < -2) return -99;
    }
    return -99;
  }
  solvePower(c, ang, tx, ty) {
    let lo = 8, hi = 40; if ((this.predict(c, ang, hi, tx) ?? -99) < ty) return null;
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2, y = this.predict(c, ang, mid, tx); if (y === null || y < ty) lo = mid; else hi = mid; }   // hitting the hill counts as short
    return this.predict(c, ang, hi, tx) === null ? null : hi;
  }
  isCpu() { return this.demo || (this.cpu && this.player === 1); }
  // CPU artillery: aims at a live king with the drag-free formula, then corrects by how far its last shot fell short or long
  cpuAim() {
    this.cpuT = (this.cpuT || 0) + DT; const c = this.cannon, r = this.rnd;
    const ai = this.ais[this.player], foe = 1 - this.player;
    if (!ai.plan) {
      const live = this.alive(foe), tgt = live[Math.floor(r() * live.length)], [tx, ty] = centre(tgt);
      const opts = Object.keys(this.inv).filter(k => this.inv[k] > 0 && k !== 'sticky' && k !== 'rocket');
      this.ammo = r() < 0.55 ? opts[Math.floor(r() * opts.length)] : 'noodle'; if (!(this.inv[this.ammo] > 0)) this.ammo = 'noodle';
      // try angles; for each, find the power whose predicted arc (gravity, wind, drag) reaches the king, and keep those that clear the hill
      const shots = [];
      for (let ang = 25; ang <= 75; ang += 5) { const v = this.solvePower(c, ang, tx, ty + 0.6); if (v) shots.push([ang, v]); }
      const [ang, v] = shots.length ? shots[Math.floor(r() * shots.length)] : [55, 30];
      const skill = 0.93 + r() * 0.14;   // a little human error
      ai.plan = { angle: this.player ? 180 - ang : ang, power: Math.max(c.minP, Math.min(c.maxP, v * ai.k * skill)), tx };
    }
    this.ai = ai;
    const p = this.ai.plan; c.angle += Math.sign(p.angle - c.angle) * Math.min(Math.abs(p.angle - c.angle), 60 * DT); c.power += Math.sign(p.power - c.power) * Math.min(Math.abs(p.power - c.power), 20 * DT);
    if (this.cpuT > 1.4 && Math.abs(c.angle - p.angle) < 0.5 && Math.abs(c.power - p.power) < 0.3) { this.fire(); this.ai.shot = p; this.ai.plan = null; }
  }
  cpuFly() {
    const n = this.noodle, sp = this.sp; if (!n || !this.ai.shot) return;
    if (sp.kind === 'bomb' && !sp.used && this.shotT > 0.5) { const [cx] = n.com(); if (Math.abs(cx - this.ai.shot.tx) < 4) this.selfDestruct(n, this.player ? { left: 1, down: 1 } : { right: 1, down: 1 }); }
    if (sp.kind === 'ball' && sp.grip.length && this.shotT > 0.6) this.letGo();
    if (this.judge.chain && this.judge.chain.still > 0.8 && !this.ai.learned) {   // learn: scale power by target distance over landing distance
      const [cx] = n.com(), want = Math.abs(this.cannon.x - this.ai.shot.tx), got = Math.abs(this.cannon.x - cx);
      if (got > 2) this.ai.k = Math.max(0.9, Math.min(1.1, this.ai.k * Math.pow(want / got, 0.25))); this.ai.learned = true;
    }
  }
  fire() { super.fire(); this.ai.learned = false; }
  hud() {
    const dots = (s) => this.kings[s].map(k => k.down ? '○' : '♛').join('');
    const who = this.cpu ? (this.player ? 'CPU' : 'You') : 'Player ' + (this.player + 1);
    return { left: `${who} · turn ${this.turn + 1}`, score: `${dots(0)}  vs  ${dots(1)}`, sub: `wind ${this.wind > 0 ? '→' : this.wind < 0 ? '←' : '·'} ${Math.abs(this.wind).toFixed(1)}`, wind: this.wind };
  }
  camTarget() {
    if (this.phase === 'fly' && this.noodle) { const [x, y] = this.noodle.com(); return [x, Math.max(y, 5), 0.85]; }
    if (this.phase === 'settle' && this.noodle) { const [x] = this.noodle.com(); return [x, 5, 0.8]; }
    return [FIELD / 2, 9, 0.42];   // aiming: show both forts
  }
}
