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
