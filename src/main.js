// page: input, fixed-step loop, HUD, menus, effects and local records. The sim never reads the clock.
import { seedFrom } from './engine.js';
import { FAMILIES } from './noodle.js';
import { LaunchParty } from './modes/launch.js';
import { BarrelRelay } from './modes/relay.js';
import { FlopGolf } from './modes/golf.js';
import { NoodleSiege } from './modes/siege.js';
import { ToyBox } from './modes/toybox.js';
import { AMMO } from './modes/base.js';
import { TOY_LIST } from './toys.js';
import { View } from './render.js';
import { Sfx } from './audio.js';

const MODES = { launch: LaunchParty, relay: BarrelRelay, golf: FlopGolf, siege: NoodleSiege, toybox: ToyBox };
const $ = (id) => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem('noodle.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('noodle.' + k, JSON.stringify(v)); } catch { /* private window: forget */ } } };

const view = new View($('cv')), sfx = new Sfx();
view.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let mode = null, modeId = null, modeOpt = {}, seedLabel = '', acc = 0, slowmo = false, toyPlace = null, toySel = null, toyClear = false, last = 0, hitstop = 0, paused = false, roundShown = false, bestShot = null;

// ---------------- input ----------------
const keys = new Set(), pressed = new Set();
const ptr = { x: 0, y: 0, moved: false, down: false, downAt: 0, type: 'mouse', clickP: false, releaseP: false };
addEventListener('keydown', (e) => {
  if (e.repeat) return; sfx.wake();
  const k = e.key.toLowerCase(); keys.add(k); pressed.add(k);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (k === 'escape') showMenu(); if (k === 'm') { sfx.on = !sfx.on; toast(sfx.on ? 'Sound on' : 'Sound off'); }
  if (k === 'r' && mode) start(modeId, seedLabel, modeOpt); if (k === 'n' && mode) start(modeId, 'random', modeOpt);
  if (k === 'z' && mode) { slowmo = !slowmo; toast(slowmo ? 'Slow motion' : 'Normal speed'); }
  if (mode && modeId === 'toybox') { if (k === 't') toyPlace = view.toWorld(ptr.x, ptr.y).x; if (k === 'x') toyClear = true; if (k === '[' || k === ']') { const i = TOY_LIST.indexOf(mode.toy); toySel = TOY_LIST[(i + (k === ']' ? 1 : TOY_LIST.length - 1)) % TOY_LIST.length]; toast('Toy: ' + toySel); } }
  if (k === 'p' && mode) paused = !paused;
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
const cv = $('cv');
cv.addEventListener('pointermove', (e) => { ptr.x = e.offsetX; ptr.y = e.offsetY; ptr.moved = true; ptr.type = e.pointerType; });
cv.addEventListener('pointerdown', (e) => { sfx.wake(); ptr.button = e.button; if (e.button === 2) return; cv.setPointerCapture(e.pointerId); ptr.x = e.offsetX; ptr.y = e.offsetY; ptr.down = true; ptr.downAt = performance.now(); ptr.type = e.pointerType; ptr.clickP = true; ptr.moved = true; });
cv.addEventListener('pointerup', () => { ptr.down = false; ptr.releaseP = true; });
cv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (mode && modeId === 'toybox') toyPlace = view.toWorld(e.offsetX, e.offsetY).x; });
for (const b of document.querySelectorAll('[data-hold]')) {
  const k = b.dataset.hold;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.wake(); keys.add(k); pressed.add(k); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => keys.delete(k));
}
function readInput() {
  const has = (...k) => k.some(x => keys.has(x)), was = (...k) => k.some(x => pressed.has(x));
  const fly = mode && mode.phase === 'fly', touch = ptr.type !== 'mouse';
  const inp = { left: has('a', 'arrowleft'), right: has('d', 'arrowright'), up: has('w', 'arrowup'), down: has('s', 'arrowdown'),
    tuck: has('shift', 's', 'arrowdown', 'tuck') || (fly && ptr.down && performance.now() - ptr.downAt > 180),
    fireP: was(' ', 'enter', 'fire'), puffP: was(' ', 'w', 'arrowup', 'fire'), skipP: was('enter'),
    glide: has('e', 'g', 'glide'), actionH: has(' ', 'fire'), cycle: was('q') ? 1 : 0 };
  for (const [id, a] of Object.entries(AMMO)) if (was(a.key)) inp.ammo = id;
  if (pickedAmmo) { inp.ammo = pickedAmmo; pickedAmmo = null; }
  if (toyPlace !== null) { inp.place = toyPlace; toyPlace = null; } if (toySel) { inp.toy = toySel; toySel = null; } if (toyClear) { inp.clear = true; toyClear = false; }
  if (!fly && ptr.moved && mode) inp.aim = view.toWorld(ptr.x, ptr.y);
  // mouse: click fires / puffs toward the pointer. touch: drag to aim, lift to fire; tap to puff in flight.
  if (fly && ptr.clickP) { inp.puffP = true; inp.puffDir = view.toWorld(ptr.x, ptr.y); }
  if (!fly && ((!touch && ptr.clickP && ptr.button !== 2) || (touch && ptr.releaseP))) inp.fireP = true;
  if (keys.has('left')) inp.left = true; if (keys.has('right')) inp.right = true;
  pressed.clear(); ptr.clickP = false; ptr.releaseP = false; ptr.moved = false;
  return inp;
}

// ---------------- flow ----------------
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
let pickedAmmo = null;
function start(id, seed, opt = {}) {
  modeId = id; modeOpt = opt; seedLabel = seed === 'random' ? 'R' + Math.floor(Math.random() * 1e6) : seed || today();
  mode = new MODES[id](seedFrom(id + ':' + seedLabel), opt); roundShown = false; paused = false; slowmo = false;
  buildBars();
  view.parts.length = 0; view.pops.length = 0; view.follow(mode, 1, true);
  const g = store.get(`ghost.${id}.${seedLabel}`, null); view.ghost = g ? g.trail : null; bestShot = g;
  $('menu').hidden = true; $('result').hidden = true; $('hud').hidden = false; $('touch').hidden = !matchMedia('(pointer: coarse)').matches;
  $('mtitle').textContent = MODES[id].title; $('seed').textContent = seedLabel.startsWith('R') ? 'random ' + seedLabel.slice(1) : 'daily ' + seedLabel;
  toast(mode.hint, 2600);
}
function showMenu() {
  mode = null; $('menu').hidden = false; $('hud').hidden = true; $('result').hidden = true; $('touch').hidden = true;
  for (const id of ['launch', 'relay', 'golf']) { const b = store.get('best.' + id, null); $('best-' + id).textContent = b === null ? 'no record yet' : id === 'golf' ? `best card: ${b} strokes` : `best: ${b.toLocaleString()}`; }
  const w = store.get('siege.wins', 0), l = store.get('siege.losses', 0); $('best-siege').textContent = w + l ? `vs CPU: ${w} won, ${l} lost` : 'no battles yet';
}
for (const b of document.querySelectorAll('[data-play]')) b.onclick = () => { sfx.wake(); start(b.dataset.play, $('seedSel').value === 'random' ? 'random' : today(), b.dataset.players ? { players: +b.dataset.players } : {}); };
$('again').onclick = () => start(modeId, seedLabel, modeOpt); $('newseed').onclick = () => start(modeId, 'random', modeOpt); $('tomenu').onclick = showMenu;

let toastT = 0;
function toast(t, ms = 1800) { $('toast').textContent = t; $('toast').style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => $('toast').style.opacity = 0, ms); }

// ---------------- effects from simulation events ----------------
const CONF = ['#ff4f6d', '#ffd23f', '#4fd1ff', '#7dffb2', '#9b7bff', '#ff8a00'];
function effects(m) {
  for (const e of m.fx) {
    switch (e.type) {
      case 'boom': sfx.boom(); view.kick(0.5); view.burst(e.x, e.y, 18, ['smoke'], 4, 0.9, 2, 0.25); view.burst(e.x, e.y, 12, ['#ffd23f', '#ff8a00'], 9, 0.4); break;
      case 'bonk': if (e.ours || e.speed > 12) { sfx.bonk(e.speed); view.burst(e.x, e.y, Math.min(14, e.speed / 2), ['#fff', '#d8c3a5'], e.speed * 0.25, 0.5); if (e.ours && e.speed > 16) { view.kick(e.speed / 60); hitstop = Math.max(hitstop, e.speed > 24 ? 5 : 3); } if (e.ours && e.head && e.speed > 12 && m.noodle) m.noodle.daze = 1.2; } break;
      case 'boing': sfx.boing(); view.burst(e.x, e.y, 8, ['#ff4fa3', '#fff'], 6, 0.4); break;
      case 'puff': sfx.puff(); view.burst(e.x + e.dx * 0.4, e.y + e.dy * 0.4, 14, ['smoke'], 3, 0.5, 0, 0.18); break;
      case 'pop': sfx.pop(); view.burst(e.x, e.y, 20, [e.color || '#ff5d8f', '#fff'], 8, 0.6); break;
      case 'kaboom': sfx.kaboom(); view.kick(1); hitstop = 6; view.burst(e.x, e.y, 40, ['#ff8a00', '#ffd23f', '#ff3b3b'], 14, 0.7); view.burst(e.x, e.y, 26, ['smoke'], 5, 1.4, 1, 0.4); break;
      case 'trick': { const f = e.fam; sfx.trick(e.mult); view.pop(e.x, e.y, e.title, `+${e.pts}  ×${e.mult}`, famColor(f)); if (e.mult >= 3) view.burst(e.x, e.y, 10, CONF, 7, 0.9); break; }
      case 'star': sfx.pop(); view.burst(e.x, e.y, 16, ['#ffd23f', '#fff'], 7, 0.6); break;
      case 'catch': sfx.catch(); view.pop(e.x, e.y + 1, `Caught! #${e.hop}`, `+${e.pts}`, '#7dffb2', true); view.burst(e.x, e.y, 18, CONF, 8, 0.8); break;
      case 'splash': sfx.splash(); view.burst(e.x, e.y, 30, ['#bfefff', '#38b2e0', '#fff'], 9, 0.9); break;
      case 'shot': {
        const r = e.result; view.pop(m.camTarget()[0], m.camTarget()[1] + 3, `Shot ${e.shot}: ${r.score.toLocaleString()}`, r.families.map(f => FAMILIES[f]).join(' · '), '#ffd23f', true);
        if (!bestShot || r.score > bestShot.score) { bestShot = { score: r.score, trail: m.trail.slice() }; store.set(`ghost.${modeId}.${seedLabel}`, bestShot); }
        break; }
      case 'rest': if (e.result.score > 0) view.pop(e.x, m.groundY(e.x) + 2, `style ${e.result.score}`, null, '#ffd23f'); break;
      case 'stroke': break;
      case 'sink': sfx.fanfare(); view.pop(e.x, e.y + 2, e.name, `${e.strokes} stroke${e.strokes > 1 ? 's' : ''}`, '#ffd23f', true); view.burst(e.x, e.y + 1, 50, CONF, 10, 1.4); break;
      case 'newhole': toast(`Hole ${e.hole}`); buildBars(); break;
      case 'caption': toast(e.text); break;
      case 'round': setTimeout(() => showResult(m, e), 1400); break;
      case 'flame': view.burst(e.x, e.y, 2, ['#ffd23f', '#ff8a00', '#ff3b3b'], 3, 0.35, 0, 0.12); if (sfx.gate('flame', 90)) sfx.noise(0.12, 0.15, 900); for (const p of view.parts.slice(-2)) { p.vx += e.dx * 12; p.vy += e.dy * 12; } break;
      case 'grab': sfx.tone(300, 120, 0.1, 'square', 0.15); view.burst(e.x, e.y, 8, ['#ff4fa3', '#fff'], 4, 0.4); break;
      case 'release': sfx.tone(500, 900, 0.1, 'triangle', 0.15); break;
      case 'kingdown': sfx.fanfare(); view.kick(0.8); view.pop(e.x, e.y + 2, e.side === e.by ? 'Own goal, Your Majesty' : 'KING DOWN!', null, '#ffd23f', true); view.burst(e.x, e.y, 30, ['#ffd23f', '#fff', '#ff4f6d'], 9, 1); break;
      case 'turn': toast(e.cpu ? `CPU is aiming… wind ${windTxt(e.wind)}` : `${m.cpu ? 'Your' : 'Player ' + (e.player + 1) + "'s"} turn · wind ${windTxt(e.wind)}`, 2200); buildBars(); break;
      case 'ammo': { const a = AMMO[e.id]; toast(`${a.icon} ${a.name}: ${a.desc}`, 2600); buildBars(); break; }
      case 'placed': view.burst(e.x, 1, 14, ['#fff', '#ffd23f'], 6, 0.5); sfx.pop(); break;
    }
  }
  m.fx.length = 0;
}
function windTxt(w) { return (w > 0 ? '→ ' : w < 0 ? '← ' : '') + Math.abs(w).toFixed(1); }
function famColor(f) { return { glide: '#a0ffea', swing: '#ff4fa3', rocket: '#ff8a00', boom: '#ff3b3b', ride: '#c0c4d6', strike: '#ffffff', air: '#4fd1ff', spin: '#9b7bff', bonk: '#ff8a00', smash: '#ff4f6d', boing: '#ff4fa3', puff: '#e0e0e0', target: '#ffd23f', skim: '#7dffb2', far: '#b0f0ff', tuck: '#c9a7ff' }[f] || '#fff'; }

function showResult(m, e) {
  if (roundShown || m !== mode) return; roundShown = true; sfx.fanfare();
  let html = '', better = false;
  if (modeId === 'launch') {
    const b = store.get('best.launch', 0); better = e.total > b; if (better) store.set('best.launch', e.total);
    html = `<h2>${e.total.toLocaleString()} points</h2><table>${e.results.map((r, i) => `<tr><td>Shot ${i + 1}</td><td>${r.score.toLocaleString()}</td><td>${r.families.map(f => FAMILIES[f]).join(' · ')}</td></tr>`).join('')}</table>`;
  } else if (modeId === 'relay') {
    const b = store.get('best.relay', 0); better = e.total > b; if (better) store.set('best.relay', e.total);
    html = `<h2>${e.hops} cannon${e.hops === 1 ? '' : 's'} · ${e.total.toLocaleString()} points</h2><p>The sea always wins eventually.</p>`;
  } else if (modeId === 'siege') {
    const youWon = e.cpu ? e.winner === 0 : null;
    if (e.cpu) store.set(youWon ? 'siege.wins' : 'siege.losses', store.get(youWon ? 'siege.wins' : 'siege.losses', 0) + 1);
    better = !!youWon;
    html = `<h2>${e.cpu ? (youWon ? 'Victory!' : 'The CPU wins') : 'Player ' + (e.winner + 1) + ' wins!'}</h2><p>${e.turns} turns · style points ${e.style.map(x => x.toLocaleString()).join(' vs ')}</p>`;
  } else {
    const b = store.get('best.golf', null); better = b === null || e.total < b; if (better) store.set('best.golf', e.total);
    const d = e.total - e.par;
    html = `<h2>${e.total} strokes (${d === 0 ? 'even' : d > 0 ? '+' + d : d})</h2><table>${e.card.map(c => `<tr><td>Hole ${c.hole}</td><td>par ${c.par}</td><td>${c.strokes}</td><td>${c.name}</td></tr>`).join('')}</table>`;
  }
  $('rbody').innerHTML = (better && modeId !== 'siege' ? '<div class="pb">New personal best!</div>' : '') + html; $('result').hidden = false;
}

// ---------------- HUD ----------------
function hud(m) {
  const h = m.hud(); $('hleft').textContent = h.left; $('hscore').textContent = typeof h.score === 'number' ? h.score.toLocaleString() : h.score; $('hsub').textContent = h.sub;
  const fam = m.judge.chain ? m.judge.chain.fam : new Set();
  $('fams').innerHTML = Object.entries(FAMILIES).map(([k, v]) => `<span class="${fam.has(k) ? 'on' : ''}" style="--c:${famColor(k)}">${v}</span>`).join('');
  $('puffs').innerHTML = m.phase === 'fly' ? '💨'.repeat(m.puffs) + '<i>' + '·'.repeat(Math.max(0, m.maxPuffs - m.puffs)) + '</i>' : '';
  if (m.inv) for (const b of document.querySelectorAll('#ammo button')) { const id = b.dataset.ammo, n = m.inv[id]; b.classList.toggle('sel', m.ammo === id); b.disabled = !(n > 0) || m.phase !== 'aim'; b.querySelector('i').textContent = n === Infinity ? '∞' : n; }
  if (m.toy) for (const b of document.querySelectorAll('#toys button')) b.classList.toggle('sel', b.dataset.toy === m.toy);
  const touch = ptr.type !== 'mouse';
  if (m.isCpu && m.isCpu()) { $('hint').textContent = 'CPU turn — sit back'; return; }
  $('hint').textContent = m.phase === 'fly' ? (touch ? '⟲ ⟳ spin · hold TUCK · tap the sky to puff that way' : '←/→ spin · hold ↓ tuck · hold E glide · Space: ' + (m.sp && m.sp.kind !== 'noodle' && m.sp.kind !== 'triple' ? AMMO[m.sp.kind].name.toLowerCase() + ' action, then puff' : 'puff (or click toward pointer)'))
    : m.phase === 'aim' ? (m.loaded ? (touch ? 'Tap FIRE when the barrel lines up' : 'Space / click: fire when the barrel lines up') : (touch ? 'Drag to aim, lift to fire' : 'Mouse or W/S A/D aim · 1–6 or Q ammo · click / Space fire')) : m.phase === 'settle' ? 'Settling…' : '';
}

function buildBars() {
  const m = mode; if (!m) return;
  $('ammo').innerHTML = m.inv && Object.keys(m.inv).length > 1 && !(m.isCpu && m.isCpu()) ? Object.entries(AMMO).filter(([id]) => id in m.inv).map(([id, a]) => `<button data-ammo="${id}" title="${a.name} (${a.key}): ${a.desc}">${a.icon}<b>${a.name}</b><i></i></button>`).join('') : '';
  for (const b of document.querySelectorAll('#ammo button')) b.onclick = (e) => { e.stopPropagation(); pickedAmmo = b.dataset.ammo; };
  $('toys').innerHTML = m.toy ? TOY_LIST.map(t => `<button data-toy="${t}">${t}</button>`).join('') + '<button data-clear>clear (X)</button>' : '';
  for (const b of document.querySelectorAll('#toys button')) b.onclick = (e) => { e.stopPropagation(); if (b.dataset.clear !== undefined) toyClear = true; else { toySel = b.dataset.toy; toast('Toy: ' + toySel + ' — right-click or press T where you want it'); } };
}
// ---------------- loop ----------------
function frame(t) {
  const dt = Math.min(0.1, (t - last) / 1000 || 0); last = t;
  if (mode && !paused) {
    // relay: time slows near a catch, so the last-second puff is possible
    let scale = 1;
    if (mode.cannons && mode.phase === 'fly' && mode.noodle) { const [x, y] = mode.noodle.com(); for (const c of mode.cannons) if (!c.used && Math.hypot(c.x - x, c.y - y) < 3.5) scale = 0.45; }
    if (slowmo) scale *= 0.3;
    acc += dt * scale;
    let n = 0;
    while (acc >= 1 / 60 && n < 5) { acc -= 1 / 60; n++; if (hitstop > 0) { hitstop--; continue; } mode.tick(readInput()); effects(mode); if (mode.noodle && mode.noodle.daze > 0) mode.noodle.daze -= 1 / 60; }
    view.follow(mode, dt);
    hud(mode);
  }
  if (mode) view.draw(mode, dt);
  else { view.cx.setTransform(1, 0, 0, 1, 0, 0); view.cx.fillStyle = '#1b1530'; view.cx.fillRect(0, 0, view.cv.width, view.cv.height); }
  requestAnimationFrame(frame);
}
addEventListener('resize', () => view.resize()); view.resize(); showMenu(); requestAnimationFrame(frame);
window.__noodle = { start, get mode() { return mode; }, view };
