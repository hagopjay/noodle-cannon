// view: Canvas2D drawing of a Mode. Reads the simulation, never writes to it.
import { centre } from './engine.js';

const THEMES = {
  carnival: { sky: ['#5bc0ff', '#ffe3b8'], far: '#b9d7ff', mid: '#8fd18a', ground: '#6a4a3a', top: '#7fcf4f', stone: '#8d8aa8' },
  sea: { sky: ['#20306f', '#ff9a8b'], far: '#3b3f8f', mid: '#6b4f9a', ground: '#4b3a5a', top: '#8a7bb8', stone: '#6d6990', sea: '#1aa2c9' },
  dusk: { sky: ['#2b1d4f', '#ff8f6b'], far: '#5a3a7a', mid: '#8a4f7a', ground: '#4a3328', top: '#c98a4b', stone: '#7a6f8f' },
  meadow: { sky: ['#8fdcff', '#f4ffe0'], far: '#b5e3c8', mid: '#86cf7e', ground: '#6b4b2e', top: '#57b84a', stone: '#9a9a9a', sand: '#f2d38a', water: '#38b2e0' },
};
const SUIT = '#ff4f6d', SKIN = '#ffd9b8', HAT = '#ffd23f';

export class View {
  constructor(canvas) {
    this.cv = canvas; this.cx = canvas.getContext('2d'); this.cam = { x: 0, y: 5, s: 40 }; this.shake = 0; this.parts = []; this.pops = [];
    this.ghost = null; this.reduced = false; this.dpr = 1; this.time = 0;
  }
  resize() {
    const d = this.dpr = Math.min(2, window.devicePixelRatio || 1), w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.cv.width = Math.round(w * d); this.cv.height = Math.round(h * d); this.W = w; this.H = h;
  }
  follow(m, dt, snap) {
    const [tx, ty, z] = m.camTarget(), base = Math.min(this.H / 18, this.W / 26);   // portrait phones frame by width
    let sp = 0; if (m.noodle && m.phase === 'fly') sp = m.noodle.speed();
    const ts = base * z / (1 + sp / 70), k = snap ? 1 : 1 - Math.exp(-dt * 4);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k; this.cam.s += (ts - this.cam.s) * (snap ? 1 : 1 - Math.exp(-dt * 2));
  }
  X(x) { return (x - this.cam.x) * this.cam.s + this.W / 2 + this.sx; }
  Y(y) { return this.H * 0.58 - (y - this.cam.y) * this.cam.s + this.sy; }
  toWorld(px, py) { return { x: (px - this.W / 2) / this.cam.s + this.cam.x, y: (this.H * 0.58 - py) / this.cam.s + this.cam.y }; }

  // ---- effects that live only in the view ----
  burst(x, y, n, colors, speed = 6, life = 0.8, grav = -12, size = 0.12) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + speed * 0.3, life, t: 0, c: colors[i % colors.length], g: grav, s: size * (0.6 + Math.random() * 0.8), rot: Math.random() * 6 }); }
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
  }
  pop(x, y, text, sub, color = '#fff', big = false) {   // stagger bursts of tricks so each one gets read
    const waiting = this.pops.filter(p => p.t < 0.25).length, slot = this.pops.filter(p => p.t < 0.9).length % 4; this.pops.push({ x, y, text, sub, color, t: -0.22 * waiting, big, slot }); if (this.pops.length > 12) this.pops.shift(); }
  kick(a) { if (!this.reduced) this.shake = Math.min(1.2, this.shake + a); }

  draw(m, dt) {
    const c = this.cx, th = THEMES[m.theme] || THEMES.carnival; this.time += dt;
    this.shake *= Math.exp(-dt * 7); const sh = this.shake * 10; this.sx = (Math.random() - 0.5) * sh; this.sy = (Math.random() - 0.5) * sh;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // sky and parallax
    const g = c.createLinearGradient(0, 0, 0, this.H); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); c.fillStyle = g; c.fillRect(0, 0, this.W, this.H);
    this.parallax(th);
    // sea / water behind terrain
    if (m.theme === 'sea') this.sea(th);
    // static shapes
    for (const s of m.W.S) this.shape(s, th, m);
    for (const f of m.W.fields) this.field(f);
    if (m.water) this.water(m, th);
    if (m.cup) this.flag(m);
    if (m.flags) for (const d of m.flags) this.distFlag(d);
    // ghost and trail
    if (this.ghost && this.ghost.length > 1) this.path(this.ghost, 'rgba(155,123,255,0.55)', 3, [6, 8]);
    if (m.trail.length > 1) this.path(m.trail, 'rgba(255,255,255,0.65)', 2.5, [2, 7]);
    // quads
    for (const q of m.W.Q) this.quad(q);
    this.ropes(m); this.freeBits(m);
    if (m.stars) for (const s of m.stars) if (!s.got) this.star(s.x, s.y);
    // cannons
    const cannons = m.cannons || [m.cannon];
    for (const k of cannons) if (k && Math.abs(k.x - this.cam.x) * this.cam.s < this.W) this.cannon(k, m);
    if (m.phase === 'aim' && m.cannon && !m.done && m.cannon.maxP !== m.cannon.minP) this.aimArc(m);
    if (m.sp && m.sp.grab && m.noodle) { const g = m.sp.grab; c.strokeStyle = '#ff4fa3'; c.lineWidth = 3; c.beginPath(); c.moveTo(this.X(g.hand.x), this.Y(g.hand.y)); c.lineTo(this.X(g.target.x), this.Y(g.target.y)); c.stroke(); }
    // noodles: old bodies first
    for (const n of m.bodies) if (n !== m.noodle && !n.list[0].off) this.noodle(n, false, m);
    if (m.noodle) this.noodle(m.noodle, true, m);
    // particles and popups
    this.fx(dt); this.popups(dt);
  }
  parallax(th) {
    const c = this.cx, cx = this.cam.x;
    for (const [col, k, amp, base, f] of [[th.far, 0.15, 60, 0.62, 0.004], [th.mid, 0.35, 45, 0.74, 0.007]]) {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, this.H);
      for (let x = 0; x <= this.W + 20; x += 20) { const wx = x + cx * this.cam.s * k; c.lineTo(x, this.H * base - amp * (Math.sin(wx * f) * 0.6 + Math.sin(wx * f * 2.3 + 1) * 0.4) + (this.cam.y - 5) * this.cam.s * k * 0.5); }
      c.lineTo(this.W, this.H); c.fill();
    }
    // clouds
    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 7; i++) { const wx = ((i * 337 - cx * this.cam.s * 0.08) % (this.W + 300) + this.W + 300) % (this.W + 300) - 150, wy = 40 + (i * 53) % (this.H * 0.35);
      c.beginPath(); c.ellipse(wx, wy, 46, 16, 0, 0, 7); c.ellipse(wx + 30, wy - 8, 30, 14, 0, 0, 7); c.ellipse(wx - 28, wy - 4, 24, 11, 0, 0, 7); c.fill(); }
  }
  sea(th) {
    const c = this.cx, y = this.Y(-6); c.fillStyle = th.sea; c.beginPath(); c.moveTo(0, this.H);
    for (let x = 0; x <= this.W + 10; x += 10) c.lineTo(x, y + Math.sin((x / this.cam.s + this.cam.x) * 1.3 + this.time * 2) * 4);
    c.lineTo(this.W, this.H); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.beginPath();
    for (let x = 0; x <= this.W + 10; x += 10) c.lineTo(x, y + Math.sin((x / this.cam.s + this.cam.x) * 1.3 + this.time * 2) * 4); c.stroke();
  }
  shape(s, th, m) {
    const c = this.cx;
    if (s.maxx < this.cam.x - this.W / this.cam.s || s.minx > this.cam.x + this.W / this.cam.s) return;
    if (s.type === 'circle') {
      const r = s.r * this.cam.s, x = this.X(s.x), y = this.Y(s.y);
      if (s.kind === 'bumper') { s.flash = (s.flash || 0) * 0.9; const rr = r * (1 + (s.flash || 0) * 0.25);
        c.fillStyle = '#ff4fa3'; c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill(); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x, y, rr * 0.45, 0, 7); c.fill(); }
      else if (s.kind === 'target') { c.fillStyle = s.color || '#ff5d8f'; c.beginPath(); c.ellipse(x, y, r * 0.9, r * 1.1, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + r * 1.1); c.lineTo(x + Math.sin(this.time * 2 + s.x) * 4, y + r * 2.6); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.35, r * 0.2, r * 0.3, -0.5, 0, 7); c.fill(); }
      else { c.fillStyle = '#444'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
      return;
    }
    const col = s.kind === 'sand' ? th.sand : s.kind === 'stone' ? th.stone : s.kind === 'tramp' ? '#4fd1ff' : s.kind === 'cup' ? '#3b2a1a' : th.ground;
    c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath();
    s.v.forEach(([x, y], i) => i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y))); c.closePath(); c.fill(); c.stroke();
    if (s.kind === 'grass' || s.kind === 'ground' || s.kind === 'sand') {   // the top edge: the one whose normal points up most
      let bi = 0; s.n.forEach((n, i) => { if (n[1] > s.n[bi][1]) bi = i; });
      const a = s.v[bi], b = s.v[(bi + 1) % s.v.length]; c.strokeStyle = s.kind === 'sand' ? '#e5bf6a' : th.top; c.lineWidth = 0.35 * this.cam.s; c.lineCap = 'round';
      c.beginPath(); c.moveTo(this.X(a[0]), this.Y(a[1]) + 0.12 * this.cam.s); c.lineTo(this.X(b[0]), this.Y(b[1]) + 0.12 * this.cam.s); c.stroke(); c.lineCap = 'butt';
    }
    if (s.kind === 'tramp') { c.fillStyle = '#ffd23f'; for (let x = s.minx + 0.3; x < s.maxx; x += 0.6) { c.fillRect(this.X(x), this.Y(s.maxy), 0.25 * this.cam.s, 0.12 * this.cam.s); } }
  }
  water(m, th) {
    const c = this.cx, w = m.water, y0 = m.groundFn(w.x0) - 0.3; c.fillStyle = 'rgba(56,178,224,0.85)';
    c.beginPath(); c.moveTo(this.X(w.x0), this.Y(y0));
    for (let x = w.x0; x <= w.x1; x += 0.25) c.lineTo(this.X(x), this.Y(Math.min(y0 + Math.sin(x * 3 + this.time * 3) * 0.05, y0)));
    for (let x = w.x1; x >= w.x0; x -= 0.25) c.lineTo(this.X(x), this.Y(m.groundFn(x)));
    c.fill();
  }
  flag(m) {
    const c = this.cx, x = (m.cup.x0 + m.cup.x1) / 2, y = m.cup.y, s = this.cam.s;
    c.strokeStyle = '#eee'; c.lineWidth = 3; c.beginPath(); c.moveTo(this.X(x), this.Y(y - m.cup.depth)); c.lineTo(this.X(x), this.Y(y + 4.2)); c.stroke();
    const wv = Math.sin(this.time * 5) * 0.15; c.fillStyle = '#ff3b3b'; c.beginPath(); c.moveTo(this.X(x), this.Y(y + 4.2)); c.lineTo(this.X(x + 1.6), this.Y(y + 3.8 + wv)); c.lineTo(this.X(x), this.Y(y + 3.3)); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(this.X(m.cup.x0), this.Y(y), (m.cup.x1 - m.cup.x0) * s, 0.2 * s);
  }
  distFlag(d) {
    const c = this.cx; if (Math.abs(d - this.cam.x) * this.cam.s > this.W) return;
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = `bold ${Math.round(0.7 * this.cam.s)}px system-ui, sans-serif`; c.textAlign = 'center';
    c.fillRect(this.X(d) - 1, this.Y(2), 2, 2 * this.cam.s); c.fillText(d + ' m', this.X(d), this.Y(2.3));
  }
  quad(q) {
    const c = this.cx, v = q.v; if (v[0].off) return;
    if (q.maxx < this.cam.x - this.W / this.cam.s || q.minx > this.cam.x + this.W / this.cam.s) return;
    const fill = q.kind === 'tnt' ? (q.fuse ? (Math.floor(this.time * 30) % 2 ? '#fff' : '#ff3b3b') : '#e8392f') : q.kind === 'plank' ? '#d99a5b' : q.kind === 'mill' ? '#9b7bff'
      : q.kind === 'pin' ? '#fbf7ee' : q.kind === 'king' ? (q.down ? '#8f8a7a' : '#ffd23f') : '#e8b25e';
    c.fillStyle = fill; c.strokeStyle = 'rgba(60,30,10,0.75)'; c.lineWidth = Math.max(1, 0.06 * this.cam.s); c.lineJoin = 'round';
    c.beginPath(); v.forEach((p, i) => i ? c.lineTo(this.X(p.x), this.Y(p.y)) : c.moveTo(this.X(p.x), this.Y(p.y))); c.closePath(); c.fill(); c.stroke();
    if (q.kind === 'crate') { c.beginPath(); c.moveTo(this.X(v[0].x), this.Y(v[0].y)); c.lineTo(this.X(v[2].x), this.Y(v[2].y)); c.moveTo(this.X(v[1].x), this.Y(v[1].y)); c.lineTo(this.X(v[3].x), this.Y(v[3].y)); c.stroke(); }
    if (q.kind === 'pin') { const [x, y] = centre(q), a = Math.atan2(v[1].y - v[0].y, v[1].x - v[0].x); c.save(); c.translate(this.X(x), this.Y(y)); c.rotate(-a); c.fillStyle = '#e8392f'; c.fillRect(-0.13 * this.cam.s, -0.18 * this.cam.s, 0.26 * this.cam.s, 0.07 * this.cam.s); c.restore(); }
    if (q.kind === 'king') { const [x, y] = centre(q), a = Math.atan2(v[1].y - v[0].y, v[1].x - v[0].x), s = this.cam.s; c.save(); c.translate(this.X(x), this.Y(y)); c.rotate(-a);
      c.fillStyle = q.down ? '#b0a890' : '#ffb000'; c.beginPath(); c.moveTo(-0.4 * s, -0.5 * s); c.lineTo(-0.4 * s, -0.95 * s); c.lineTo(-0.2 * s, -0.7 * s); c.lineTo(0, -1.0 * s); c.lineTo(0.2 * s, -0.7 * s); c.lineTo(0.4 * s, -0.95 * s); c.lineTo(0.4 * s, -0.5 * s); c.fill(); c.stroke();
      c.fillStyle = '#2b2d42'; c.beginPath(); c.arc(-0.15 * s, -0.05 * s, 0.06 * s, 0, 7); c.arc(0.15 * s, -0.05 * s, 0.06 * s, 0, 7); c.fill(); c.lineWidth = 2; c.beginPath(); c.arc(0, 0.12 * s, 0.14 * s, q.down ? Math.PI + 0.3 : 0.3, q.down ? -0.3 : Math.PI - 0.3); c.stroke(); c.restore(); }
    if (q.kind === 'tnt') { const [x, y] = centre(q); c.fillStyle = '#fff'; c.font = `900 ${Math.round(0.36 * this.cam.s)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.save(); c.translate(this.X(x), this.Y(y)); c.rotate(-Math.atan2(v[1].y - v[0].y, v[1].x - v[0].x)); c.fillText('TNT', 0, 0); c.restore(); c.textBaseline = 'alphabetic'; }
  }
  field(f) {   // a fan's updraft: drifting streaks
    const c = this.cx; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const x = f.x0 + (f.x1 - f.x0) * (i + 0.5) / 9, h = f.y1 - f.y0, y = f.y0 + ((this.time * 6 + i * 1.7) % h);
      c.beginPath(); c.moveTo(this.X(x), this.Y(y)); c.lineTo(this.X(x + Math.sin(this.time * 4 + i) * 0.1), this.Y(y + 0.8)); c.stroke(); }
    c.fillStyle = '#555'; c.fillRect(this.X(f.x0 + 0.1), this.Y(f.y0), (f.x1 - f.x0 - 0.2) * this.cam.s, 0.15 * this.cam.s);
  }
  ropes(m) {
    const c = this.cx; c.lineWidth = Math.max(1.5, 0.06 * this.cam.s); c.strokeStyle = '#3b2f2a';
    for (const r of m.W.ropes) { if (r.length < 2) continue; c.beginPath(); r.forEach((p, i) => { if (p.off) return; i ? c.lineTo(this.X(p.x), this.Y(p.y)) : c.moveTo(this.X(p.x), this.Y(p.y)); }); c.stroke(); }
  }
  freeBits(m) {
    const c = this.cx, s = this.cam.s;
    for (const p of m.W.P) {
      if (p.off || p.quad) continue;
      if (p.tag === 'iron') { const g = c.createRadialGradient(this.X(p.x) - p.r * s * 0.3, this.Y(p.y) - p.r * s * 0.3, 1, this.X(p.x), this.Y(p.y), p.r * s); g.addColorStop(0, '#8a8f9c'); g.addColorStop(1, '#1d1f27'); c.fillStyle = g; c.beginPath(); c.arc(this.X(p.x), this.Y(p.y), p.r * s, 0, 7); c.fill(); }
      else if (p.tag === 'balloon') { c.fillStyle = p.color || '#ff5d8f'; c.beginPath(); c.ellipse(this.X(p.x), this.Y(p.y), p.r * s * 0.9, p.r * s * 1.1, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(this.X(p.x) - p.r * s * 0.3, this.Y(p.y) - p.r * s * 0.35, p.r * s * 0.2, p.r * s * 0.3, -0.5, 0, 7); c.fill(); }
      else if (p.tag === 'hook') { c.fillStyle = '#2b2d42'; c.fillRect(this.X(p.x) - 0.6 * s, this.Y(p.y) - 0.4 * s, 1.2 * s, 0.4 * s); c.strokeStyle = 'rgba(43,45,66,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(this.X(p.x), this.Y(p.y) - 0.4 * s); c.lineTo(this.X(p.x), 0); c.stroke(); }
    }
  }
  star(x, y) {
    const c = this.cx, r = 0.45 * this.cam.s, X = this.X(x), Y = this.Y(y + Math.sin(this.time * 3 + x) * 0.15);
    c.fillStyle = '#ffd23f'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5 + this.time, rr = i % 2 ? r * 0.45 : r; c.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.stroke();
  }
  cannon(k, m) {
    const c = this.cx, s = this.cam.s, a = k.angle * Math.PI / 180, X = this.X(k.x), Y = this.Y(k.y);
    if (k.type === 'swing') { c.strokeStyle = '#555'; c.lineWidth = 2; c.beginPath(); c.moveTo(this.X(k.base[0]), this.Y(k.base[1] + k.swingL)); c.lineTo(X, Y); c.stroke(); }
    if (k.type === 'slide') { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 4; c.beginPath(); c.moveTo(X, this.Y(k.base[1] - k.slide)); c.lineTo(X, this.Y(k.base[1] + k.slide)); c.stroke(); }
    const used = k.used && k !== m.cannon, wheels = !m.cannons || k.id === 'p1' || k.id === 'p2';
    c.save(); c.translate(X, Y); c.globalAlpha = used ? 0.4 : 1;
    c.save(); c.rotate(-a); c.translate(-k.recoil * 0.5 * s, 0);
    const body = k.type === 'blast' ? '#ff8a00' : k.type === 'swivel' ? '#4fd1ff' : k.type === 'swing' ? '#9b7bff' : k.type === 'slide' ? '#7dffb2' : '#2b2d42';
    c.fillStyle = body; c.strokeStyle = '#111'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-0.5 * s, -0.55 * s); c.lineTo(k.len * s, -0.42 * s); c.lineTo(k.len * s, 0.42 * s); c.lineTo(-0.5 * s, 0.55 * s); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd23f'; c.fillRect(k.len * s - 0.22 * s, -0.48 * s, 0.22 * s, 0.96 * s); c.fillRect(0.25 * s, -0.52 * s, 0.14 * s, 1.04 * s);
    if (k.flash > 0.05) { c.fillStyle = `rgba(255,220,90,${k.flash})`; c.beginPath(); c.moveTo(k.len * s, -0.5 * s); c.lineTo((k.len + 1.6 * k.flash) * s, 0); c.lineTo(k.len * s, 0.5 * s); c.fill(); }
    c.restore();
    if (wheels) { c.fillStyle = '#6b3e1e'; c.beginPath(); c.arc(-0.1 * s, 0.45 * s, 0.55 * s, 0, 7); c.fill(); c.strokeStyle = '#2b1a0c'; c.stroke(); c.beginPath(); c.arc(-0.1 * s, 0.45 * s, 0.15 * s, 0, 7); c.fillStyle = '#ffd23f'; c.fill(); }
    if (m.loaded && k === m.loaded && m.phase === 'aim' && k.type !== 'start') { c.strokeStyle = '#fff'; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.arc(0, 0, 1.6 * s, 0, 7); c.stroke(); c.setLineDash([]);
      const left = Math.max(0, 1 - m.wait / (k.type === 'blast' ? 0.45 : 4)); c.strokeStyle = '#ffd23f'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 1.6 * s, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); c.stroke(); }
    c.restore();
    if (m.loaded && m.phase === 'aim' && k === m.loaded) this.path(k.arc(m.W.g, 0.28, 10), 'rgba(255,255,255,0.8)', 3, [3, 6]);
  }
  aimArc(m) {
    const k = m.cannon, pts = k.arc(m.W.g, 0.55, 16);
    this.path(pts, 'rgba(255,255,255,0.9)', 3, [4, 7]);
    const c = this.cx, [x, y] = pts[0]; c.fillStyle = '#fff'; c.font = '600 13px system-ui, sans-serif'; c.textAlign = 'left';
    c.fillText(`${k.angle.toFixed(0)}°  ${k.power.toFixed(0)} m/s`, this.X(k.x) - 30, this.Y(k.y) + 1.6 * this.cam.s);
  }
  path(pts, col, w, dash) {
    const c = this.cx; c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath();
    pts.forEach(([x, y], i) => i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y))); c.stroke(); c.setLineDash([]);
  }
  noodle(n, live, m) {
    const c = this.cx, P = n.parts, s = this.cam.s, L = (a, b, w, col) => { c.strokeStyle = col; c.lineWidth = w * s; c.beginPath(); c.moveTo(this.X(P[a].x), this.Y(P[a].y)); c.lineTo(this.X(P[b].x), this.Y(P[b].y)); c.stroke(); };
    c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = live ? 1 : 0.75;
    const dark = live ? '#c9304d' : '#9a6b78', suit = live ? SUIT : '#c7a0aa';
    L('elbowL', 'handL', 0.15, SKIN); L('chest', 'elbowL', 0.18, dark); L('kneeL', 'footL', 0.17, dark); L('pelvis', 'kneeL', 0.2, dark);
    L('chest', 'pelvis', 0.42, suit);
    L('kneeR', 'footR', 0.17, suit); L('pelvis', 'kneeR', 0.2, suit); L('chest', 'elbowR', 0.18, suit); L('elbowR', 'handR', 0.15, SKIN);
    c.fillStyle = '#2b2d42'; for (const f of ['footL', 'footR']) { c.beginPath(); c.arc(this.X(P[f].x), this.Y(P[f].y), 0.12 * s, 0, 7); c.fill(); }
    // head with a face that reacts
    const h = P.head, ch = P.chest, hx = this.X(h.x), hy = this.Y(h.y), ang = Math.atan2(-(h.y - ch.y), h.x - ch.x) + Math.PI / 2;
    c.fillStyle = SKIN; c.beginPath(); c.arc(hx, hy, 0.24 * s, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5; c.stroke();
    c.save(); c.translate(hx, hy); c.rotate(ang);
    c.fillStyle = HAT; c.beginPath(); c.moveTo(-0.17 * s, -0.17 * s); c.lineTo(0.02 * s, -0.62 * s); c.lineTo(0.19 * s, -0.15 * s); c.fill();
    c.fillStyle = '#ff4fa3'; c.beginPath(); c.arc(0.02 * s, -0.63 * s, 0.07 * s, 0, 7); c.fill();
    const w = live && m.phase === 'fly' ? Math.abs(n.omega()) : 0, dazed = n.daze > 0;
    c.strokeStyle = '#222'; c.fillStyle = '#fff'; c.lineWidth = Math.max(1, 0.035 * s);
    for (const ex of [-0.09, 0.09]) {
      const X = ex * s, Y = -0.02 * s;
      if (dazed) { const r = 0.05 * s; c.beginPath(); c.moveTo(X - r, Y - r); c.lineTo(X + r, Y + r); c.moveTo(X + r, Y - r); c.lineTo(X - r, Y + r); c.stroke(); }
      else if (w > 9) { c.beginPath(); for (let t = 0; t < 12; t++) { const rr = t / 12 * 0.07 * s, aa = t * 1.1 + this.time * 12; c.lineTo(X + Math.cos(aa) * rr, Y + Math.sin(aa) * rr); } c.stroke(); }
      else { c.beginPath(); c.arc(X, Y, 0.065 * s, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#222'; c.beginPath(); c.arc(X + 0.02 * s, Y + 0.01 * s, 0.03 * s, 0, 7); c.fill(); c.fillStyle = '#fff'; }
    }
    c.beginPath(); const scared = live && m.phase === 'fly' && n.speed() > 18;
    if (scared) { c.fillStyle = '#7a1f2b'; c.ellipse(0, 0.12 * s, 0.06 * s, 0.07 * s, 0, 0, 7); c.fill(); } else { c.arc(0, 0.06 * s, 0.08 * s, 0.2, Math.PI - 0.2); c.stroke(); }
    c.restore(); c.globalAlpha = 1; c.lineCap = 'butt';
  }
  fx(dt) {
    const c = this.cx;
    for (const p of this.parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.rot += dt * 8; }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const p of this.parts) { const a = 1 - p.t / p.life, r = p.s * this.cam.s; c.globalAlpha = a; c.fillStyle = p.c;
      if (p.c === 'smoke') { c.fillStyle = 'rgba(240,240,240,0.7)'; c.beginPath(); c.arc(this.X(p.x), this.Y(p.y), r * (1 + p.t * 3), 0, 7); c.fill(); }
      else { c.save(); c.translate(this.X(p.x), this.Y(p.y)); c.rotate(p.rot); c.fillRect(-r, -r * 0.5, r * 2, r); c.restore(); } }
    c.globalAlpha = 1;
  }
  popups(dt) {
    const c = this.cx; c.textAlign = 'center';
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter(p => p.t < (p.big ? 2.2 : 1.4));
    this.pops.forEach((p, i) => {
      if (p.t < 0) return;
      const a = Math.min(1, 3 - p.t * 2), y = this.Y(p.y) - 40 - p.t * 45 - p.slot * 40, x = this.X(p.x), sc = Math.min(1, p.t * 8) * (p.big ? 1.6 : 1);
      c.globalAlpha = Math.max(0, a); c.font = `900 ${Math.round(20 * sc)}px system-ui, sans-serif`; c.lineWidth = 5; c.strokeStyle = 'rgba(30,20,50,0.85)';
      c.strokeText(p.text, x, y); c.fillStyle = p.color; c.fillText(p.text, x, y);
      if (p.sub) { c.font = `800 ${Math.round(14 * sc)}px system-ui, sans-serif`; c.strokeText(p.sub, x, y + 18 * sc); c.fillStyle = '#fff'; c.fillText(p.sub, x, y + 18 * sc); }
    });
    c.globalAlpha = 1;
  }
}
