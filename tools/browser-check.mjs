// Loads the built page in headless Chrome, plays each concept with scripted input, saves screenshots, reports console errors.
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
const { chromium } = await import(PW.startsWith('/') ? PW + '/index.mjs' : PW);
const url = 'file://' + process.cwd() + '/dist/noodle-cannon.html';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h, tag] of [[1280, 720, 'desk']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', e => errors.push(String(e)));
  await p.goto(url); await p.waitForTimeout(500); await p.screenshot({ path: 'docs/media/menu.png' });
  const key = async (k, ms = 60) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };
  // A: launch party
  await p.click('[data-play=launch]'); await p.waitForTimeout(700);
  await p.screenshot({ path: 'docs/media/launch-aim.png' });
  await p.mouse.move(900, 300); await p.waitForTimeout(200); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(500); await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(500); await p.keyboard.up('ArrowLeft');
  await p.waitForTimeout(300); await p.screenshot({ path: 'docs/media/launch-flight.png' });
  await p.waitForTimeout(1500); await p.screenshot({ path: 'docs/media/launch-impact.png' });
  const a = await p.evaluate(() => { const m = window.__noodle.mode; return { phase: m.phase, shot: m.shot, total: m.total, chain: m.judge.chain && m.judge.chain.score }; });
  console.log('launch', JSON.stringify(a));
  // B: relay
  await p.evaluate(() => window.__noodle.start('relay', '2026-11-19')); await p.waitForTimeout(600);
  await p.screenshot({ path: 'docs/media/relay-aim.png' });
  await key(' '); await p.waitForTimeout(450); await p.screenshot({ path: 'docs/media/relay-flight.png' });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const m = window.__noodle.mode; return { phase: m.phase, hops: m.hops, total: m.total }; }); console.log('relay', JSON.stringify(r));
  await p.screenshot({ path: 'docs/media/relay-later.png' });
  // C: golf
  await p.evaluate(() => window.__noodle.start('golf', '2026-11-19')); await p.waitForTimeout(600);
  await p.screenshot({ path: 'docs/media/golf-aim.png' });
  await p.mouse.move(1000, 200); await p.waitForTimeout(100); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(1200); await p.screenshot({ path: 'docs/media/golf-flight.png' });
  await p.waitForTimeout(3500);
  const g = await p.evaluate(() => { const m = window.__noodle.mode; return { phase: m.phase, strokes: m.strokes, cannonX: +m.cannon.x.toFixed(1) }; }); console.log('golf', JSON.stringify(g));
  await p.screenshot({ path: 'docs/media/golf-rest.png' });
  // ammo: rocket in Launch Party
  await p.evaluate(() => window.__noodle.start('launch', '2026-11-19')); await p.waitForTimeout(500);
  await key('4'); await p.waitForTimeout(100); await p.mouse.move(800, 380); await p.waitForTimeout(100); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(300); await p.keyboard.down(' '); await p.waitForTimeout(500); await p.screenshot({ path: 'docs/media/rocket.png' }); await p.keyboard.up(' ');
  await p.waitForTimeout(2500); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  // ammo: Munchausen ball, then glide
  await key('6'); await p.mouse.move(900, 250); await p.waitForTimeout(100); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(700); await p.screenshot({ path: 'docs/media/munchausen.png' });
  await p.waitForTimeout(2500); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await key('3'); await p.mouse.move(1000, 150); await p.waitForTimeout(100); await p.mouse.down(); await p.mouse.up();
  await p.keyboard.down('e'); await p.waitForTimeout(900); await p.screenshot({ path: 'docs/media/glide.png' }); await p.keyboard.up('e');
  console.log('ammo run', JSON.stringify(await p.evaluate(() => { const m = window.__noodle.mode; return { shot: m.shot, total: m.total, inv: m.inv }; })));
  // siege vs CPU: fire once, then let the CPU take its turn
  await p.evaluate(() => window.__noodle.start('siege', '2026-11-19', { players: 1 })); await p.waitForTimeout(600);
  await p.screenshot({ path: 'docs/media/siege-aim.png' });
  await key('5'); await p.mouse.move(1000, 200); await p.waitForTimeout(100); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(1300); await p.screenshot({ path: 'docs/media/siege-flight.png' });
  await p.waitForTimeout(9000); await p.screenshot({ path: 'docs/media/siege-cpu.png' });
  console.log('siege', JSON.stringify(await p.evaluate(() => { const m = window.__noodle.mode; return { turn: m.turn, player: m.player, phase: m.phase, kings: m.kings.map(s => s.filter(k => !k.down).length) }; })));
  // toy box: drop a toy with right-click, fire a triple
  await p.evaluate(() => window.__noodle.start('toybox', '2026-11-19')); await p.waitForTimeout(500);
  await p.click('#toys button[data-toy=pendulum]'); await p.mouse.click(1000, 500, { button: 'right' }); await p.waitForTimeout(200);
  await key('2'); await p.mouse.move(900, 300); await p.waitForTimeout(100); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(1600); await p.screenshot({ path: 'docs/media/toybox.png' });
  console.log('toybox', JSON.stringify(await p.evaluate(() => { const m = window.__noodle.mode; return { phase: m.phase, ropes: m.W.ropes.length, Q: m.W.Q.length }; })));
  // phone
  const q = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  q.on('pageerror', e => errors.push(String(e)));
  await q.goto(url); await q.waitForTimeout(300); await q.screenshot({ path: 'docs/media/phone-menu.png' });
  await q.tap('[data-play=launch]'); await q.waitForTimeout(600); await q.screenshot({ path: 'docs/media/phone-launch.png' });
  const fps = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  console.log('fps (headless SwiftShader, rough)', fps);
}
console.log('errors', errors.length, errors.slice(0, 5));
await b.close();
