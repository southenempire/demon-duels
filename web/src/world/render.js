import { TILE } from './levels.js';
import { animations, direction } from './presence.js';
import { sprites } from './sprites.js';
import { clamp, rayDistance } from './stealth.js';

const directions = ['down', 'left', 'right', 'up'];
const fps = { idle: 4, walk: 10, sneak: 7, sprint: 14, hide: 2 };
const strikeFrames = [80, 90, 110, 70, 140, 110, 120, 140];
const takedownFrames = [120, 110, 110, 140, 200, 160];
const singleFrame = (durations, elapsed) => {
  let remaining = elapsed;
  for (const [index, duration] of durations.entries()) {
    remaining -= duration;
    if (remaining < 0) return index;
  }
  return durations.length - 1;
};

export function createRenderer(canvas, assetBase, art, kind) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, y: 0 };
  const images = new Map();
  let view = { w: 0, h: 0 };
  let snap = true;
  let terrain;
  let paintedLevel;
  let environment;
  let bossManifest;
  let dirty = true;
  art.circle(kind).then((slots) => { environment = slots; dirty = true; }).catch(() => {});
  art.bosses.then((manifest) => { bossManifest = manifest; }).catch(() => {});

  function image(path) {
    if (!path) return null;
    if (!images.has(path)) {
      const img = new Image();
      img.addEventListener('load', () => { dirty = true; }, { once: true });
      img.src = assetBase + path;
      images.set(path, img);
    }
    const img = images.get(path);
    return img.complete && img.naturalWidth ? img : null;
  }

  function texture(g, slot, x, y, w, h) {
    if (!slot) return false;
    const img = image(slot.file);
    if (!img) return false;
    if (slot.rect) g.drawImage(img, ...slot.rect, x, y, w, h);
    else g.drawImage(img, x, y, w, h);
    return true;
  }

  function prop(g, slot, x, y, scale = 1) {
    if (!slot) return false;
    const [w, h] = slot.size;
    const [ax, ay] = slot.anchor ?? [w / 2, h];
    return texture(g, slot, x - ax * scale, y - ay * scale, w * scale, h * scale);
  }

  function circle(g, x, y, r, fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  function polygon(g, points, fill, stroke) {
    g.beginPath();
    g.moveTo(...points[0]);
    for (const point of points.slice(1)) g.lineTo(...point);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    if (stroke) { g.strokeStyle = stroke; g.stroke(); }
  }

  function paintTerrain(level) {
    terrain = document.createElement('canvas');
    terrain.width = level.width;
    terrain.height = level.height;
    const g = terrain.getContext('2d');
    g.imageSmoothingEnabled = false;
    const [ground, stone, accent, grass] = level.colors;
    g.fillStyle = ground;
    g.fillRect(0, 0, level.width, level.height);
    for (let y = 0; y < level.height; y += TILE) {
      for (let x = 0; x < level.width; x += TILE) {
        const n = (x * 47 + y * 137) % 97;
        const name = Object.keys(level.surfaces).find((surface) => level.surfaces[surface].some((zone) =>
          x + TILE / 2 >= zone.x && x + TILE / 2 < zone.x + zone.w && y + TILE / 2 >= zone.y && y + TILE / 2 < zone.y + zone.h));
        const tile = environment?.surfaces[name] ?? environment?.ground[n % 6 < 4 ? 0 : n % environment.ground.length];
        if (texture(g, tile, x, y, TILE, TILE)) continue;
        g.fillStyle = n % 4 === 0 ? '#ddb99b08' : '#07040b20';
        g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
        if (n % 3) polygon(g, [[x + n % 27, y + n % 30], [x + n % 27 + 5, y + n % 30 + 1],
          [x + n % 27 + 1, y + n % 30 + 4]], n % 2 ? accent + '38' : '#05030b70');
      }
    }
    const lair = level.boss.path[0];
    if (environment?.lair) {
      const [w, h] = environment.lair.size;
      const [ax, ay] = environment.lairAnchor ?? [w / 2, h * 0.49];
      const lx = Math.max(0, Math.min(level.width - w, lair.x - ax));
      const ly = Math.max(0, Math.min(level.height - h, lair.y - ay));
      texture(g, environment.lair, lx, ly, w, h);
      prop(g, environment.altar, lair.x, lair.y - 46, 0.75);
    }
    g.strokeStyle = accent + '6b';
    g.lineWidth = 2;
    g.strokeRect(7, 7, level.width - 14, level.height - 14);
    g.strokeStyle = accent + '28';
    g.strokeRect(19, 19, level.width - 38, level.height - 38);
    for (const { x, y, w, h } of level.cover) {
      g.fillStyle = '#070a0a64';
      g.fillRect(x, y, w, h);
      if (environment?.shadow) texture(g, environment.shadow, x - 8, y - 12, w + 16, h + 24);
      if (environment?.cover && image(environment.cover.file)) {
        const aw = Math.min(72, w);
        for (let ry = y + 9; ry < y + h; ry += 31) for (let rx = x + aw / 2; rx < x + w; rx += aw - 8) {
          prop(g, environment.cover, rx, Math.min(y + h, ry + 23), aw / environment.cover.size[0]);
        }
        continue;
      }
      for (let ry = y + 12; ry < y + h; ry += 14) {
        for (let rx = x + 9; rx < x + w - 4; rx += 12) {
          const tilt = (rx * 13 + ry * 7) % 11 - 5;
          polygon(g, [[rx - 5, ry + 4], [rx + tilt, ry - 8], [rx + 2, ry + 2], [rx + 6, ry - 2], [rx + 4, ry + 4]],
            tilt % 2 === 0 ? grass + '9f' : grass + '53');
        }
      }
    }
    for (const { x, y, w, h } of level.walls) {
      g.fillStyle = '#07050bbb';
      g.fillRect(x + 5, y + 6, w + 8, h + 9);
      g.fillStyle = '#130b13';
      g.fillRect(x, y, w, h);
      g.fillStyle = stone;
      g.fillRect(x, y, w, h - 9);
      if (environment?.wall && image(environment.wall.file)) {
        for (let j = y; j < y + h; j += TILE) for (let i = x; i < x + w; i += TILE) {
          texture(g, environment.wall, i, j, TILE, TILE);
        }
        prop(g, environment.prop, x + TILE / 2, y + h);
        if (w > TILE * 2) prop(g, environment.prop, x + w - TILE / 2, y + h);
        continue;
      }
      g.strokeStyle = accent + '46';
      g.strokeRect(x + 1, y + 1, w - 2, h - 11);
      g.strokeStyle = '#05030964';
      for (let ry = y + 23; ry < y + h - 9; ry += 23) {
        g.beginPath(); g.moveTo(x, ry); g.lineTo(x + w, ry); g.stroke();
        for (let rx = x + 19 + (ry % 3) * 5; rx < x + w; rx += 37) {
          g.beginPath(); g.moveTo(rx, ry - 22); g.lineTo(rx, ry); g.stroke();
        }
      }
      for (const tx of [x + 11, x + w - 12]) {
        circle(g, tx, y + h - 12, 15, accent + '1f');
        circle(g, tx, y + h - 12, 3, accent);
      }
    }
  }

  function hood(actor, color, sprite, walking = false) {
    const { x, y } = actor;
    const bob = walking ? Math.sin(performance.now() / 50) * 1.4 : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.55);
    circle(ctx, 0, 8, 21, '#05030ab8');
    ctx.restore();
    if (sprite) { ctx.drawImage(sprite, x - 26, y - 43 + bob, 52, 52); return; }
    ctx.save();
    ctx.translate(x, y + bob);
    if (actor.anim === 'sneak' || actor.anim === 'hide') ctx.scale(1.12, 0.69);
    if (Math.cos(actor.angle) < 0) ctx.scale(-1, 1);
    polygon(ctx, [[-8, -15], [6, -16], [15, 5], [8, 8], [-15, 9]], '#201522', color + 'bd');
    polygon(ctx, [[-7, -17], [-2, -29], [8, -25], [13, -16], [2, -10], [-9, -14]], '#3a293e', color);
    polygon(ctx, [[1, -22], [8, -23], [12, -17], [5, -14]], '#120c19');
    ctx.fillStyle = color;
    ctx.fillRect(6, -19, 4, 1);
    polygon(ctx, [[10, 0], [20, -6], [16, 3], [11, 5]], '#bfa7b7');
    ctx.restore();
  }

  function hunterSprite(actor, color, now) {
    const anim = actor.anim ?? 'idle';
    const sprite = image(sprites.hunter[anim]);
    if (!sprite) { hood(actor, color, null, actor.moving); return; }
    const row = directions.indexOf(direction(actor.angle));
    const frame = anim === 'strike' ? singleFrame(strikeFrames, now - (actor.animStart ?? now)) :
      anim === 'takedown' ? singleFrame(takedownFrames, now - (actor.takedownUntil ?? now) + 840) :
        Math.floor(now / (1000 / fps[anim])) % animations[anim];
    marker(actor.x, actor.y + 3, 13, '#0c0611a8', '#0c06114a');
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.filter = actor.peer ? 'hue-rotate(' + actor.hue + 'deg) saturate(1.25)' : 'brightness(1.23) drop-shadow(0 1px 1px #0d0714)';
    const size = 64;
    ctx.drawImage(sprite, frame * 48, row * 48, 48, 48, actor.x - size / 2, actor.y - size * 46 / 48, size, size);
    ctx.restore();
  }

  function marker(x, y, radius, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.64, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function render(level, kind, run, peers, dt, now) {
    const { hunter, guards, boss, lights, intel, synced, embers } = run;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const strikeZoom = run.strike ? Math.sin(Math.min(1, (now - run.strike) / 450) * Math.PI / 2) * 0.34 : 0;
    const opening = run.lookoutUntil && now < run.lookoutUntil;
    const openingZoom = opening ? Math.max(0, Math.min(1, (run.lookoutUntil - now) / 550)) * 0.22 : 0;
    const scale = Math.max(w / level.width, h / level.height, w < 600 ? 0.92 : 1.10) + strikeZoom + openingZoom;
    view = { w: w / scale, h: h / scale };
    const ease = snap ? 1 : 1 - Math.exp(-dt * (run.strike ? 15 : 8));
    const focus = opening ? boss : hunter;
    camera.x += (clamp(focus.x - view.w / 2, 0, level.width - view.w) - camera.x) * ease;
    camera.y += (clamp(focus.y - view.h / 2, 0, level.height - view.h) - camera.y) * ease;
    snap = false;
    if (dirty || paintedLevel !== level) { dirty = false; paintTerrain(level); paintedLevel = level; }
    const [ground, , accent] = level.colors;
    const slots = sprites.circles[kind];
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -camera.x * dpr * scale, -camera.y * dpr * scale);
    ctx.fillStyle = ground;
    ctx.fillRect(camera.x, camera.y, view.w, view.h);
    ctx.drawImage(terrain, 0, 0);
    for (const layer of environment?.parallax ?? []) {
      const [sw, sh] = layer.size;
      ctx.save();
      ctx.globalAlpha = 0.24;
      const width = sw * 0.75;
      const offset = camera.x - (camera.x * layer.scrollFactor % width);
      for (let px = offset; px < camera.x + view.w; px += width) texture(ctx, layer, px, 0, width, Math.min(156, sh * 0.42));
      ctx.restore();
    }
    for (const light of lights) {
      if (light.doused) { if (!prop(ctx, environment?.doused, light.x, light.y, 0.8)) circle(ctx, light.x, light.y, 5, '#4b464b'); continue; }
      const pool = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.r);
      pool.addColorStop(0, accent + '49'); pool.addColorStop(1, accent + '00');
      circle(ctx, light.x, light.y, light.r, pool);
      texture(ctx, environment?.light, light.x - light.r / 2, light.y - light.r / 2, light.r, light.r);
      if (!prop(ctx, environment?.brazier, light.x, light.y + 3, 0.9)) {
        circle(ctx, light.x, light.y, 5, '#0b060b');
        circle(ctx, light.x, light.y - 3, 3, accent);
      }
    }
    for (const guard of [...guards, boss]) {
      if (guard.soundOnly) continue;
      const points = [[guard.x, guard.y]];
      for (let i = 0; i <= 26; i++) {
        const theta = guard.angle + guard.arc * (i / 26 - 0.5);
        const r = rayDistance(guard, theta, guard.range, level.walls);
        points.push([guard.x + Math.cos(theta) * r, guard.y + Math.sin(theta) * r]);
      }
      polygon(ctx, points, guard.meter >= 30 ? '#ff514b45' : '#ffc56d1e', guard.meter >= 30 ? '#ff514b95' : '#ffc56d57');
    }
    marker(level.start.x, level.start.y, 29, '#57b3aa13', '#77c6b171');
    for (const tear of level.tears) marker(tear.x, tear.y, 20, '#825cd760', '#c69aff');
    marker(level.vantage.x, level.vantage.y, 20, '#92cfdb25', '#92cfdb');
    prop(ctx, environment?.vantage, level.vantage.x, level.vantage.y, 0.9);
    for (const scroll of level.intel.filter((entry) => !intel.includes(entry.id))) {
      marker(scroll.x, scroll.y, 10, '#85d2ff28', '#9fdcff');
      if (!prop(ctx, environment?.intel, scroll.x, scroll.y, 0.75)) {
        ctx.fillStyle = '#b6e7fa'; ctx.fillRect(scroll.x - 2, scroll.y - 7, 4, 8);
      }
      if (hunter.sight) marker(scroll.x, scroll.y, 23, '#75c4ff28', '#a0efff');
    }
    for (const ember of embers) marker(ember.x, ember.y, 18 + (ember.until - now) / 16, '#ffbe4938', '#ffd77a');
    const { x, y } = boss;
    marker(x, y, 58, accent + '14', accent + '60');
    marker(x, y, 44 + Math.sin(now / 330) * 3, accent + '14', accent);
    if (hunter.noise) marker(hunter.x, hunter.y, hunter.noise, '#00000000', '#d9ba962c');
    for (const actor of [boss, ...guards, ...peers, hunter].sort((a, b) => a.y - b.y)) {
      if (actor === boss) {
        const profile = bossManifest?.bosses?.find(({ demonId }) => demonId === kind);
        const anim = run.strike && now - run.strike > 345 ? 'hit' : boss.alert ? 'alert' : 'patrol';
        const sheet = image(profile?.files[anim]);
        if (sheet) {
          const desc = bossManifest.animations[anim];
          const { w: sw, h: sh } = bossManifest.frameSize;
          const { x: px, y: py } = bossManifest.pivot;
          const row = bossManifest.directions.indexOf(direction(boss.angle));
          const frame = anim === 'hit' ? singleFrame(desc.durationsMs, now - run.strike - 345) : Math.floor(now * desc.fps / 1000) % desc.frames;
          ctx.save(); ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sheet, frame * sw, row * sh, sw, sh, x - px * 2, y - py * 2, sw * 2, sh * 2);
          ctx.restore();
        } else if (image(slots.boss)) {
          ctx.save();
          ctx.translate(x, y);
          if (Math.cos(boss.angle) < 0) ctx.scale(-1, 1);
          ctx.drawImage(image(slots.boss), -42, -89, 96, 96);
          ctx.restore();
        }
        else hood({ x, y, angle: 0 }, accent, null);
        polygon(ctx, [[x, y - 89], [x + 6, y - 83], [x, y - 77], [x - 6, y - 83]], hunter.sight ? '#ffd387' : accent);
      } else if (actor === hunter) {
        marker(actor.x, actor.y, 18, '#09101280', actor.hidden ? '#95ebaa' : '#e5c6a8');
        hunterSprite(actor, actor.hidden ? '#95ebaa' : '#f2c59f', now);
      } else if (actor.peer) {
        hunterSprite(actor, '#a5d0f5', now);
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#bce5ff';
        ctx.fillText(actor.name, actor.x, actor.y - 61);
      } else {
        hood(actor, hunter.sight || actor.meter >= 30 ? '#ff655e' : '#e8ab78', image(sprites.sentry), true);
      }
      if (!actor.peer && actor !== hunter && (actor.meter >= 30 || actor.alert)) {
        ctx.textAlign = 'center'; ctx.font = 'bold 19px monospace';
        ctx.fillStyle = actor.alert ? '#ff745e' : '#ffd18d';
        ctx.fillText(actor.alert ? '!' : '?', actor.x, actor.y - (actor === boss ? 93 : 36));
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.27, w / 2, h / 2, Math.hypot(w, h) * 0.58);
    vignette.addColorStop(0, '#110a1700');
    vignette.addColorStop(1, '#08050ac9');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    canvas.classList.toggle('hunt-sight-on', hunter.sight);

    if (x < camera.x + 22 || x > camera.x + view.w - 22 || y < camera.y + 22 || y > camera.y + view.h - 22) {
      const px = clamp((x - camera.x) * scale, 27, w - 27);
      const py = clamp((y - camera.y) * scale, 32, h - 26);
      circle(ctx, px, py, 14, '#160f19dd');
      polygon(ctx, [[px, py - 7], [px + 6, py], [px, py + 7], [px - 6, py]], accent);
    }
    if (synced) {
      const mw = w < 600 ? 110 : 160;
      const mh = mw * level.height / level.width;
      const left = w - mw - 12;
      const top = 93;
      const k = mw / level.width;
      ctx.fillStyle = '#140b1aee'; ctx.fillRect(left, top, mw, mh);
      ctx.strokeStyle = '#e3b5a376'; ctx.strokeRect(left, top, mw, mh);
      ctx.fillStyle = '#8d6e7a';
      for (const wall of level.walls) ctx.fillRect(left + wall.x * k, top + wall.y * k, wall.w * k, wall.h * k);
      for (const scroll of level.intel) if (!intel.includes(scroll.id)) circle(ctx, left + scroll.x * k, top + scroll.y * k, 2, '#70caff');
      ctx.strokeStyle = '#eabb73';
      ctx.beginPath();
      boss.path.forEach((point, i) => i ? ctx.lineTo(left + point.x * k, top + point.y * k) : ctx.moveTo(left + point.x * k, top + point.y * k));
      ctx.stroke();
      circle(ctx, left + x * k, top + y * k, 3, '#ffb65d');
      circle(ctx, left + hunter.x * k, top + hunter.y * k, 3, '#82e7c5');
    }
  }

  return { render, snap: () => { snap = true; } };
}
