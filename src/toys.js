// sim: the toy box. Every builder takes (W, x, y-of-ground, rnd, opt) and returns the width it used.
// Shared by Launch Party, Siege, Golf and the Toy Box sandbox.

let uid = 0;
const id = (k) => k + (uid++);
export function resetIds() { uid = 0; }

export const crate = (W, x, y, o = {}) => W.quad(Object.assign({ x, y, w: 0.5, h: 0.5, id: id('c'), asleep: true }, o));
export const tnt = (W, x, y) => crate(W, x, y, { kind: 'tnt', mass: 0.8 });

export const TOYS = {
  tower(W, x, g, r, o = {}) {
    const hgt = o.h ?? 3 + Math.floor(r() * 5), cols = o.cols ?? 1 + Math.floor(r() * 2);
    for (let c = 0; c < cols; c++) for (let i = 0; i < hgt; i++) (r() < 0.12 ? tnt : crate)(W, x + c, g + 0.5 + i);
    if (r() < 0.6) crate(W, x + (cols - 1) * 0.5, g + 0.5 + hgt + 0.15, { w: 1.4, h: 0.15, kind: 'plank', mass: 0.6 });
    return cols + 1;
  },
  pyramid(W, x, g, r) {
    const b = 3 + Math.floor(r() * 3);
    for (let row = 0; row < b; row++) for (let i = 0; i < b - row; i++) (r() < 0.1 ? tnt : crate)(W, x + i * 1.02 + row * 0.51, g + 0.5 + row);
    return b + 1;
  },
  fort(W, x, g) {
    crate(W, x, g + 0.5); crate(W, x, g + 1.5); crate(W, x + 3, g + 0.5); crate(W, x + 3, g + 1.5);
    crate(W, x + 1.5, g + 2.15, { w: 2.2, h: 0.15, kind: 'plank', mass: 0.8 }); tnt(W, x + 1.5, g + 0.5); crate(W, x + 1.5, g + 2.8);
    return 4;
  },
  bumper(W, x, g, r) { W.circle(x, g + 3 + r() * 7, 0.75, { kick: 15 + r() * 6, kind: 'bumper', id: id('bump'), rest: 0.9 }); return 1.5; },
  tramp(W, x, g, r) { W.poly([[x - 1.6, g], [x + 1.6, g], [x + 1.6, g + 0.35], [x - 1.6, g + 0.35]], { kick: 17 + r() * 4, kind: 'tramp', id: id('tramp'), rest: 0.85, fric: 0.2 }); return 3.5; },
  ramp(W, x, g, r) { const L = 4 + r() * 3, H = 1 + r() * 1.4; W.poly([[x, g], [x + L, g], [x + L, g + H]], { kind: 'stone', id: id('ramp'), fric: 0.25 }); return L; },
  balloons(W, x, g, r) {
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) { const s = W.circle(x + i * 1.6, g + 4 + r() * 8, 0.55, { kind: 'target', id: id('bal') }); s.label = 'Balloon Pop!'; s.pts = 120; s.color = ['#ff5d8f', '#ffd23f', '#4fd1ff', '#9b7bff'][i % 4]; }
    return n * 1.6;
  },
  // a fan blows straight up: limp noodles fly, tucked ones punch through
  fan(W, x, g, r) {
    const h = 9 + r() * 5; W.poly([[x - 1.2, g], [x + 1.2, g], [x + 1.2, g + 0.4], [x - 1.2, g + 0.4]], { kind: 'fan', id: id('fan') });
    W.fields.push({ x0: x - 1.3, x1: x + 1.3, y0: g + 0.4, y1: g + 0.4 + h, ax: 0, ay: 70, id: id('field') });
    return 3;
  },
  // a heavy iron ball on a chain, already swinging
  pendulum(W, x, g, r) {
    const top = g + 9 + r() * 3, a = W.anchor(x, top), L = 5 + r() * 2;   // hangs from a sky hook (drawn by the view)
    a.tag = 'hook';
    const ball = W.particle({ x: x + L * 0.8, y: top - L * 0.6, r: 0.6, mass: 30, tag: 'iron', grp: -4, sail: 0, fric: 0.3, rest: 0.2 });
    W.rope(a, ball, 8, { mass: 0.3 }); W.addVel(ball, 0, -2);
    return 4;
  },
  // seesaw: a plank pinned at its middle. Land on one end, launch whatever sits on the other
  seesaw(W, x, g, r) {
    W.poly([[x - 0.5, g], [x + 0.5, g], [x, g + 1.0]], { kind: 'stone', id: id('pivot') });
    const q = W.quad({ x, y: g + 1.15, w: 2.8, h: 0.12, kind: 'plank', mass: 3, id: id('saw') }), a = W.anchor(x, g + 1.15);
    for (const v of q.v) W.stick(a, v);
    crate(W, x + 2.4, g + 1.8, { asleep: false }); if (r() < 0.5) tnt(W, x + 2.4, g + 2.8);
    return 6;
  },
  // a rope bridge of planks between two posts, over a gap
  bridge(W, x, g, r) {
    const n = 7 + Math.floor(r() * 4), w = 0.9, y = g + 3.5, x0 = x, x1 = x + n * w;
    W.poly([[x0 - 0.6, g], [x0, g], [x0, y], [x0 - 0.6, y]], { kind: 'stone', id: id('pier') });
    W.poly([[x1, g], [x1 + 0.6, g], [x1 + 0.6, y], [x1, y]], { kind: 'stone', id: id('pier') });
    let prev = [W.anchor(x0, y - 0.1), W.anchor(x0, y + 0.1)];
    for (let i = 0; i < n; i++) {
      const q = W.quad({ x: x0 + w * (i + 0.5), y: y - 0.02, w: w / 2 - 0.04, h: 0.1, kind: 'plank', mass: 0.5, id: id('bp') });
      W.stick(prev[0], q.v[0], { min: 0, max: 0.1 }); W.stick(prev[1], q.v[3], { min: 0, max: 0.1 });
      prev = [q.v[1], q.v[2]];
    }
    const e0 = W.anchor(x1, y - 0.1), e1 = W.anchor(x1, y + 0.1); W.stick(prev[0], e0, { min: 0, max: 0.1 }); W.stick(prev[1], e1, { min: 0, max: 0.1 });
    if (r() < 0.7) tnt(W, x0 + w * (n / 2), y + 0.6);
    return n * w + 2;
  },
  // ten bowling pins in a triangle
  pins(W, x, g) {
    const rows = [4, 3, 2, 1]; let k = 0;
    rows.forEach((n, ri) => { for (let i = 0; i < n; i++) { W.quad({ x: x + ri * 0.45 + i * 0.9, y: g + 0.45, w: 0.13, h: 0.45, kind: 'pin', mass: 0.4, id: 'pin' + (uid) + '_' + (k++), asleep: true, fric: 0.4 }); } });
    uid++; return 4;
  },
  // a crate carried up by balloons. Pop the balloons and it drops
  skycrate(W, x, g, r) {
    const y = g + 6 + r() * 6, c = crate(W, x, y, { asleep: false, kind: r() < 0.5 ? 'tnt' : 'crate', mass: 0.8 });
    const n = 3; for (let i = 0; i < n; i++) {
      const b = W.particle({ x: x - 0.8 + i * 0.8, y: y + 2.4 + (i % 2) * 0.4, r: 0.45, mass: 0.2, gs: -1.64, drag: 0.05, tag: 'balloon', grp: -5 - i, sail: 0.2, rest: 0.6 });
      b.color = ['#ff5d8f', '#4fd1ff', '#ffd23f'][i]; W.rope(c.v[3 - (i > 1 ? 1 : 0)], b, 4, { mass: 0.02, slack: 1 });
    }
    return 3;
  },
};
export const TOY_LIST = Object.keys(TOYS);
