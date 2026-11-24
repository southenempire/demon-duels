// A single retained canvas loop: remounting the surrounding UI never adds loops.
export class PitEffects {
  constructor() {
    this.canvas = null;
    this.particles = [];
    this.last = 0;
    this.raf = 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    document.addEventListener('visibilitychange', () => this.wake());
    this.reduced.addEventListener('change', () => this.wake());
  }

  mount(canvas) {
    this.canvas = canvas;
    this.wake();
  }

  wake() {
    cancelAnimationFrame(this.raf);
    this.last = 0;
    if (!document.hidden && !this.reduced.matches && this.canvas?.isConnected) this.raf = requestAnimationFrame((time) => this.tick(time));
  }

  burst(side, critical, color) {
    if (this.reduced.matches) return;
    const x = side === 0 ? 0.72 : 0.28;
    for (let i = 0; i < (critical ? 80 : 35); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.12 + Math.random() * 0.4;
      this.particles.push({ x, y: 0.55, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color, size: 1 + Math.random() * (critical ? 5 : 3), burst: true });
    }
  }

  tick(time) {
    if (!this.canvas?.isConnected || document.hidden || this.reduced.matches) return;
    const dt = Math.min((time - (this.last || time)) / 1000, 0.04);
    this.last = time;
    const canvas = this.canvas;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (Math.random() < dt * 18 && this.particles.length < 180) this.particles.push({ x: Math.random(), y: 1.05, vx: (Math.random() - 0.5) * 0.025, vy: -0.025 - Math.random() * 0.045, life: 1, color: Math.random() > 0.5 ? '#ff9b50' : '#b395f7', size: 0.5 + Math.random() * 1.8 });
    this.particles = this.particles.filter((p) => p.life > 0 && p.y > -0.1);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.burst) p.vy += dt * 0.3;
      p.life -= dt * (p.burst ? 1.1 : 0.11);
      ctx.globalAlpha = Math.max(0, Math.min(p.life, 0.8));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * width, p.y * height, p.size, p.size * (p.burst ? 1 : 2.5));
    }
    ctx.globalAlpha = 1;
    this.raf = requestAnimationFrame((next) => this.tick(next));
  }
}
