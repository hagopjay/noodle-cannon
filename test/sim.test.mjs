// Gates for the shared physics and the three concepts. Run: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { World, centre, quadAngle } from '../src/engine.js';
import { Noodle } from '../src/noodle.js';
import { LaunchParty } from '../src/modes/launch.js';
import { BarrelRelay } from '../src/modes/relay.js';
import { FlopGolf } from '../src/modes/golf.js';

const I = (o = {}) => Object.assign({ left: 0, right: 0, up: 0, down: 0, fireP: 0, puffP: 0, tuck: 0 }, o);
function play(M, seed, frames, bot) { const m = new M(seed); for (let f = 0; f < frames && !m.done; f++) { m.fx.length = 0; m.tick(bot(m, f)); } return m; }
const launchBot = (m, f) => I({ fireP: m.phase === 'aim' && f % 40 === 0, left: m.phase === 'fly' && f % 90 < 30, tuck: m.phase === 'fly' && f % 90 < 50, puffP: m.phase === 'fly' && f % 70 === 0 });

test('a ten-crate stack stands still for 10 s', () => {
  const W = new World(); W.poly([[-20, 0], [20, 0], [20, -3], [-20, -3]]);
  const qs = []; for (let i = 0; i < 10; i++) qs.push(W.quad({ x: 0, y: 0.5 + i, w: 0.5, h: 0.5 }));
  for (let i = 0; i < 600; i++) W.step();
  const [x, y] = centre(qs[9]);
  assert.ok(Math.abs(x) < 0.05 && Math.abs(y - 9.5) < 0.05, `top crate drifted to ${x.toFixed(3)}, ${y.toFixed(3)}`);
  assert.ok(Math.abs(quadAngle(qs[9])) < 0.02);
});

test('knocking out the middle of a sleeping stack brings the top down (no floating crates)', () => {
  const W = new World(); W.poly([[-20, 0], [20, 0], [20, -3], [-20, -3]]);
  const qs = []; for (let i = 0; i < 8; i++) qs.push(W.quad({ x: 0, y: 0.5 + i, w: 0.5, h: 0.5 }));
  for (let i = 0; i < 300; i++) W.step();
  assert.ok(qs[7].asleep, 'top should be asleep before the hit');
  W.particle({ x: -5, y: 3, r: 0.25, mass: 8, vx: 30, vy: 2 });
  for (let i = 0; i < 300; i++) W.step();
  assert.ok(centre(qs[7])[1] < 6, 'top crate should have fallen');
});

test('tucking spins the noodle faster: angular momentum is conserved, inertia drops', () => {
  const W = new World({ g: 0 }); const n = new Noodle(W, 0, 10, 0, 0, { grp: 1 }); n.spin(4);
  const run = (k) => { for (let i = 0; i < k; i++) { const L0 = n.angular()[0]; W.step(); n.keepMomentum(L0); } };
  run(20); const w0 = Math.abs(n.omega());
  n.setTuck(true); run(60); const w1 = Math.abs(n.omega());
  n.setTuck(false); run(60); const w2 = Math.abs(n.omega());
  assert.ok(w1 > w0 * 2, `tucked ${w1.toFixed(2)} vs spread ${w0.toFixed(2)} rad/s`);
  assert.ok(w2 < w1, 'spreading out slows the spin again');
});

for (const [M, frames, bot] of [[LaunchParty, 3000, launchBot], [BarrelRelay, 2500, (m, f) => I({ fireP: m.phase === 'aim' && m.wait > 0.3 })], [FlopGolf, 3000, (m, f) => I({ fireP: m.phase === 'aim' && f % 30 === 0 })]]) {
  test(`${M.title}: same seed and inputs give the same world, and nothing goes NaN`, () => {
    const a = play(M, 1234, frames, bot), b = play(M, 1234, frames, bot), c = play(M, 999, frames, bot);
    assert.equal(a.W.hash(), b.W.hash());
    assert.notEqual(a.W.hash(), c.W.hash());
    assert.ok(a.W.P.every(p => p.off || (Number.isFinite(p.x) && Number.isFinite(p.y))));
  });
}

test('Launch Party: a round of five shots completes and scores', () => {
  const m = play(LaunchParty, 7, 9000, launchBot);
  assert.ok(m.done && m.results.length === 5, 'five shots'); assert.ok(m.total > 0);
});

test('Barrel Relay: perfectly timed fire with no air control reaches at least 3 cannons on 5 seeds', () => {
  for (const s of [1, 2, 3, 4, 5]) {
    const m = play(BarrelRelay, s, 3000, (m) => I({ fireP: m.phase === 'aim' && m.wait > 0.3 && (m.loaded.type !== 'swivel' || Math.abs(m.loaded.angle - m.loaded.a0) < 2.5) }));
    assert.ok(m.hops >= 3, `seed ${s}: ${m.hops} hops`);
  }
});

test('Flop Golf: every hole of 5 seeds can be sunk by a simple aiming bot', () => {
  const bot = (m, f) => { if (m.phase !== 'aim') return I(); const dx = (m.cup.x0 + m.cup.x1) / 2 - m.cannon.x; m.cannon.angle = dx >= 0 ? 50 : 130; m.cannon.power = Math.max(5, Math.min(34, Math.sqrt(20 * Math.abs(dx)) * (0.8 + 0.25 * ((m.strokes * 7) % 10) / 10))); return I({ fireP: f % 20 === 0 }); };
  for (const s of [11, 12, 13, 14, 15]) { const m = play(FlopGolf, s, 12000, bot); assert.ok(m.done, `seed ${s}: stuck on hole ${m.hole + 1} after ${m.strokes} strokes`); }
});

// ---------- v0.2: toys, ammo, glide, siege, toy box ----------
import { NoodleSiege } from '../src/modes/siege.js';
import { ToyBox } from '../src/modes/toybox.js';
import { TOYS } from '../src/toys.js';
import { rng } from '../src/engine.js';

test('toys settle without blowing up: bridge, seesaw, pendulum, sky crate, pins, fan', () => {
  const W = new World(); W.poly([[-20, 0], [120, 0], [120, -3], [-20, -3]]); const r = rng(3);
  let x = 0; for (const k of ['bridge', 'seesaw', 'pendulum', 'skycrate', 'pins', 'fan']) x += TOYS[k](W, x, 0, r) + 6;
  const sky = W.Q.find(q => q.v.some(v => W.ropes.some(rp => rp[0] === v)));
  const y0 = centre(sky)[1];
  for (let i = 0; i < 600; i++) W.step();
  assert.ok(W.P.every(p => p.off || (Number.isFinite(p.x) && Math.abs(p.x) < 500 && Math.abs(p.y) < 500)), 'everything finite and nearby');
  const maxV = Math.max(...W.Q.map(q => Math.hypot(q.v[0].vx0, q.v[0].vy0))); assert.ok(maxV < 3, `a toy is still moving fast after 10 s: ${maxV.toFixed(2)} m/s`);
  assert.ok(Math.abs(centre(sky)[1] - y0) < 3, `balloon crate should hover, moved ${(centre(sky)[1] - y0).toFixed(2)} m`);
});

test('spreading out glides: a spread noodle falls slower than a limp one', () => {
  const drop = (pose) => { const W = new World(); const n = new Noodle(W, 0, 60, 18, 0, { grp: 1, angle: -Math.PI / 2 }); n.setPose(pose);
    for (let i = 0; i < 90; i++) { n.aero(1 / 60); W.step(); } return n.com()[1]; };
  const loose = drop('loose'), spread = drop('spread');
  assert.ok(spread > loose + 2, `spread ends at ${spread.toFixed(1)} m, limp at ${loose.toFixed(1)} m`);
});

const fly = (ammo, act) => { const m = new LaunchParty(77); m.ammo = ammo; let speedAfter = 0;
  for (let f = 0; f < 900 && m.shot < 1; f++) { const fl = m.phase === 'fly'; m.tick(I({ fireP: !fl && f === 5, ...(fl ? act(m, f) : {}) })); if (fl && m.noodle && m.shotT > 0.55 && m.shotT < 0.6) speedAfter = m.noodle.speed(); m.fx.length = 0; }
  return { m, speedAfter }; };
test('every ammo fires, acts and finishes a shot with a finite world', () => {
  for (const ammo of ['noodle', 'triple', 'sticky', 'rocket', 'bomb', 'ball']) {
    const { m } = fly(ammo, (m) => I({ puffP: m.shotT > 0.4 && m.shotT < 0.45, actionH: m.shotT > 0.2 && m.shotT < 1 }));
    assert.equal(m.shot, 1, ammo + ' shot did not end'); assert.ok(m.W.P.every(p => p.off || Number.isFinite(p.x)), ammo + ' NaN');
    assert.equal(m.inv[ammo], ammo === 'noodle' ? Infinity : 0, ammo + ' inventory');
  }
});
test('the bomb rocket-jumps you and the rocket boots add speed', () => {
  const base = fly('noodle', () => I()).speedAfter;
  const bomb = fly('bomb', (m) => I({ puffP: m.shotT > 0.5 && m.shotT < 0.52, up: 1 })).speedAfter;
  const rocket = fly('rocket', (m) => I({ actionH: m.shotT < 0.55 })).speedAfter;
  assert.ok(bomb > base + 8, `bomb ${bomb.toFixed(1)} vs ${base.toFixed(1)} m/s`); assert.ok(rocket > base + 5, `rocket ${rocket.toFixed(1)} vs ${base.toFixed(1)} m/s`);
});
test('sticky hands grab something and can let go', () => {
  const W = new World(); W.poly([[-20, 0], [40, 0], [40, -3], [-20, -3]]);
  const m = new LaunchParty(1); m.W = W; m.cannon.angle = 10; m.cannon.power = 14; m.ammo = 'sticky'; m.inv.sticky = 1; m.fire();
  let grabbed = false; for (let i = 0; i < 240 && !grabbed; i++) { m.stepWorld(); grabbed = !!m.sp.grab; }
  assert.ok(grabbed, 'no grab'); m.release(); assert.equal(m.sp.grab, null);
});
test('Noodle Siege: the CPU playing both sides always finishes a battle (6 seeds)', () => {
  for (const s of [1, 2, 3, 4, 5, 6]) { const m = new NoodleSiege(s, { demo: true }); for (let f = 0; f < 40000 && !m.done; f++) { m.fx.length = 0; m.tick(I()); }
    assert.ok(m.done && m.winner >= 0, `seed ${s}: turn ${m.turn}`); }
});
test('Noodle Siege is deterministic', () => {
  const run = () => { const m = new NoodleSiege(9, { demo: true }); for (let f = 0; f < 2500; f++) { m.fx.length = 0; m.tick(I()); } return m.W.hash(); };
  assert.equal(run(), run());
});
test('Toy Box: placing toys and clearing the field', () => {
  const m = new ToyBox(2), q0 = m.W.Q.length; m.tick(I({ toy: 'pyramid' })); m.tick(I({ place: 30 })); assert.ok(m.W.Q.length > q0);
  m.tick(I({ clear: true })); assert.equal(m.W.Q.length, 0);
});

test('Flop Golf: hazards from Launch Party appear and clubs unlock hole by hole', () => {
  const kinds = new Set(); let withClubs = 0;
  for (const s of [11, 12, 13, 14, 15, 16, 17, 18]) { const m = new FlopGolf(s); for (const q of m.W.Q) kinds.add(q.kind); for (const b of m.W.S) kinds.add(b.kind); if (m.inv.rocket === 1) withClubs++; assert.equal(m.inv.noodle, Infinity); assert.equal(m.inv.bomb, undefined, 'bomb is locked on hole 1'); }
  assert.equal(withClubs, 8);
  assert.ok(['tnt', 'tramp', 'fan', 'plank', 'bumper'].some(k => kinds.has(k)), `no Launch Party hazard in 8 seeds: ${[...kinds]}`);
  const m = new FlopGolf(11); m.hole = 2; m.build(); assert.deepEqual(Object.keys(m.inv).sort(), ['ball', 'bomb', 'noodle', 'rocket', 'sticky']);
});

test('Flop Golf: every club fires, ends the shot and uses itself up', () => {
  for (const club of ['rocket', 'bomb', 'sticky', 'ball']) {
    const m = new FlopGolf(21); m.hole = 2; m.build(); m.pickAmmo(club); assert.equal(m.ammo, club);
    const s0 = m.strokes; m.fire(); assert.equal(m.inv[club], 0, club + ' is consumed'); assert.equal(m.strokes, s0 + 1);
    for (let f = 0; f < 3000 && m.phase === 'fly'; f++) { m.fx.length = 0; m.tick(I({ puffP: f % 25 === 0, actionH: f < 60 })); }
    assert.notEqual(m.phase, 'fly', club + ' shot never ended');
    assert.ok(!m.sp.grab, 'grabs released');
  }
});

test('Flop Golf with hazards and clubs is deterministic (same seed, same hash)', () => {
  const bot = (m, f) => { if (m.phase !== 'aim') return I(); const dx = (m.cup.x0 + m.cup.x1) / 2 - m.cannon.x; m.cannon.angle = dx >= 0 ? 50 : 130; m.cannon.power = Math.max(5, Math.min(34, Math.sqrt(20 * Math.abs(dx)))); if (m.strokes === 0 && m.inv.rocket) m.pickAmmo('rocket'); return I({ fireP: f % 20 === 0 }); };
  const a = play(FlopGolf, 31, 1500, bot), b = play(FlopGolf, 31, 1500, bot);
  assert.equal(a.W.hash(), b.W.hash());
});

test('Flop Golf: pick up at par+6 so a hole can never strand the player', () => {
  const m = new FlopGolf(3); m.hole = 2; m.build(); m.strokes = m.par + 6; m.tick(I());
  assert.equal(m.phase, 'between'); assert.equal(m.card.at(-1).name, 'Pick up (+6)');
});
