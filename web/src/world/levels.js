import ash from './circles/0.json' with { type: 'json' };
import hollow from './circles/1.json' with { type: 'json' };
import bone from './circles/2.json' with { type: 'json' };
import mire from './circles/3.json' with { type: 'json' };
import frost from './circles/4.json' with { type: 'json' };
import gloam from './circles/5.json' with { type: 'json' };

export const TILE = 32;
const point = ([x, y]) => ({ x: x * TILE, y: y * TILE });
const rect = ([x, y, w, h]) => ({ x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE });

export const levels = [ash, hollow, bone, mire, frost, gloam].map((data) => ({
  ...data, width: data.w * TILE, height: data.h * TILE, start: point(data.spawn),
  colors: data.palette, walls: [...data.layers.walls, ...data.layers.props].map(rect), cover: data.hideZones.map(rect),
  vantage: point(data.vantage), checkpoints: data.checkpoints.map(point),
  patrols: data.patrols.map(({ path, speed, cone }) => ({
    path: path.map(point), speed, arc: cone.deg * Math.PI / 180, range: cone.range * TILE,
  })),
  boss: { path: data.boss.patrol.map(point), speed: 26, arc: Math.PI * 2 / 3, range: 8 * TILE,
    strikeRadius: data.boss.strikeRadius * TILE, hearing: data.signature.hearingMultiplier ?? 1 },
  lights: data.lights.map(({ x, y, r, douseable }) => ({ ...point([x, y]), r: r * TILE, douseable })),
  intel: data.intel.map(({ id, x, y, text }) => ({ ...point([x, y]), id, text })),
  tears: (data.signature.tears ?? []).map(point),
  surfaces: Object.fromEntries(Object.entries(data.surfaces).map(([name, zones]) => [name, zones.map(rect)])),
}));
