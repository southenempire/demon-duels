const frame = (image, rect, id = '') => ({ ...image, rect, id });
const named = (assets, predicate) => assets.find(predicate);
const end = (asset, name) => asset.file.endsWith('/' + name + '.png');

export function environmentSlots(manifest, kind) {
  if (manifest?.tileSize !== 32) return null;
  const circle = manifest.circles?.find((entry) => entry.id === kind);
  if (!circle) return null;
  const assets = (Array.isArray(manifest.assets) ? manifest.assets : Object.entries(manifest.assets ?? {})
    .map(([file, asset]) => ({ ...asset, file }))).filter((asset) => asset.circle === kind && asset.file?.startsWith('world/' + kind + '/'));
  const atlas = named(assets, (asset) => asset.file === circle.tileset);
  if (!atlas) return null;
  const options = (atlas.grid?.cells ?? []).map((cell) => ({ ...frame(atlas, cell.rect, cell.id), layer: cell.layer, collision: cell.collision }));
  const old = (id) => atlas.frames?.[id] && frame(atlas, atlas.frames[id].rect, id);
  const ground = options.length ? options.filter((cell) => cell.layer === 'ground' && !cell.collision && !/edge|join|water|ice|rift|snow/.test(cell.id)).slice(0, 5) :
    ['floor', 'floor-worn', 'floor-inlaid'].map(old).filter(Boolean);
  const wall = options.find((cell) => cell.collision && (cell.layer === 'walls' || /wall|pillar|rock/.test(cell.id))) ?? old('wall');
  const surfaces = Object.fromEntries(['bone', 'water', 'ice', 'snow'].map((type) => [type, options.find((cell) => cell.id === type) ??
    (type === 'bone' ? old('signature-floor') : null)]));
  const parallax = assets.filter((asset) => asset.type === 'parallax' || asset.category === 'bg')
    .sort((a, b) => a.scrollFactor - b.scrollFactor);
  return {
    ground, wall, surfaces, parallax,
    cover: named(assets, (asset) => asset.type === 'hide' || asset.category === 'cover'),
    prop: named(assets, (asset) => asset.type === 'cover-pillar' || asset.category === 'prop' && asset.collision),
    light: named(assets, (asset) => end(asset, 'light-overlay') || end(asset, 'overlay-light')),
    shadow: named(assets, (asset) => end(asset, 'shadow-overlay') || end(asset, 'overlay-shadow')),
    fog: named(assets, (asset) => end(asset, 'overlay-fog')),
    brazier: named(assets, (asset) => end(asset, 'smelter-brazier') || end(asset, 'witchlight')),
    doused: named(assets, (asset) => end(asset, 'brazier-doused')),
    vantage: named(assets, (asset) => end(asset, 'vantage')),
    intel: named(assets, (asset) => end(asset, 'intel-scroll')),
    lair: named(assets, (asset) => asset.type === 'lair-background' || end(asset, 'lair-backdrop')),
    altar: named(assets, (asset) => end(asset, 'centerpiece') || asset.category === 'lair' && !/composed|backdrop|pillar/.test(asset.id)),
    lairAnchor: circle.lair?.centerpiece,
  };
}

export const loadManifest = (url) => fetch(url).then((response) => response.ok ? response.json() : null).catch(() => null);

export function loadWorldArt(base) {
  const packs = ['environment-0-2', 'environment-3-5'].map((name) => loadManifest(base + 'world/' + name + '.json'));
  return {
    circle: (kind) => packs[kind < 3 ? 0 : 1].then((manifest) => environmentSlots(manifest, kind)),
    bosses: loadManifest(base + 'world/bosses/manifest.json'),
  };
}
