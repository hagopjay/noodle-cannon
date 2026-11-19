// view: tiny synthesised sound kit (no files). Starts on the first user gesture.
export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.last = {}; }
  wake() { if (!this.ctx) try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.on = false; } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  gate(k, ms) { const t = performance.now(); if (this.last[k] && t - this.last[k] < ms) return false; this.last[k] = t; return true; }
  tone(f0, f1, dur, type = 'sine', vol = 0.2) {
    if (!this.on || !this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, freq = 800, q = 0.7) {
    if (!this.on || !this.ctx) return; const c = this.ctx, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start();
  }
  boom() { this.noise(0.5, 0.5, 600); this.tone(140, 40, 0.4, 'sine', 0.5); }
  kaboom() { this.noise(0.9, 0.7, 400); this.tone(90, 25, 0.8, 'sawtooth', 0.25); }
  bonk(speed) { if (this.gate('bonk', 60)) this.tone(260 + speed * 9, 90, 0.12, 'triangle', Math.min(0.35, speed / 60)); }
  boing() { if (this.gate('boing', 80)) this.tone(180, 720, 0.25, 'sine', 0.3); }
  puff() { this.noise(0.18, 0.25, 2200); }
  pop() { this.tone(900, 1500, 0.06, 'square', 0.12); this.noise(0.08, 0.2, 3000); }
  trick(n) { if (this.gate('trick', 70)) this.tone(520 + n * 80, 780 + n * 120, 0.12, 'square', 0.07); }
  catch() { this.tone(330, 660, 0.12, 'triangle', 0.25); setTimeout(() => this.tone(660, 990, 0.14, 'triangle', 0.2), 90); }
  splash() { this.noise(0.6, 0.4, 1200); }
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'triangle', 0.22), i * 110)); }
}
