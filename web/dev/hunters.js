// Stand-in for the stealth world: emits the local pose and draws the live hunters it receives.
const world = document.getElementById('world');
const canvas = world.querySelector('canvas');
const hint = document.getElementById('hint');
const ctx = canvas.getContext('2d');
const TILE = 32;
const circle = Number(new URLSearchParams(location.search).get('circle') ?? 2);
const me = { x: 2 + Math.random() * 6, y: 3 + Math.random() * 4, dir: 'down', anim: 'idle' };
const keys = new Set();
let hunters = [];
let mounted = true;

const nearest = () => hunters.filter((h) => Math.hypot(h.x - me.x, h.y - me.y) <= 1.5)
  .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
const emitPose = (detail) => window.dispatchEvent(new CustomEvent('demon-duels:hunter-pose', { detail }));

addEventListener('keydown', (event) => {
  if (!mounted) return;
  keys.add(event.key.toLowerCase());
  const target = nearest();
  if (event.key.toLowerCase() === 'e' && target) {
    window.dispatchEvent(new CustomEvent('demon-duels:challenge-hunter', { detail: { id: target.id } }));
  }
});
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('demon-duels:hunters', (event) => { if (event.detail.circle === circle) hunters = event.detail.hunters; });
window.addEventListener('demon-duels:launch', () => { mounted = false; world.hidden = true; emitPose({ circle: null }); });
window.addEventListener('demon-duels:return', () => { mounted = true; world.hidden = false; });
window.devHunter = { me, circle, hunters: () => hunters };

function draw(hunter, color, label) {
  ctx.fillStyle = color;
  ctx.fillRect(hunter.x * TILE - 10, hunter.y * TILE - 14, 20, 28);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, hunter.x * TILE - 30, hunter.y * TILE - 20);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mounted) {
    const dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    const dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    me.anim = dx || dy ? 'walk' : 'idle';
    if (dx) me.dir = dx > 0 ? 'right' : 'left'; else if (dy) me.dir = dy > 0 ? 'down' : 'up';
    me.x = Math.max(0.5, Math.min(19.5, me.x + dx * 4 * dt));
    me.y = Math.max(0.5, Math.min(12, me.y + dy * 4 * dt));
    emitPose({ circle, x: me.x, y: me.y, dir: me.dir, anim: me.anim });
    ctx.fillStyle = '#17121c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const h of hunters) draw(h, 'hsl(' + h.hue + ' 70% 55%)', h.name + (h.busy ? ' (busy)' : ''));
    draw(me, '#ffbd5c', 'You');
    const target = nearest();
    hint.textContent = target ? 'E: Challenge ' + target.name : 'WASD to walk · E to challenge a nearby hunter · ' + hunters.length + ' other hunters';
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
