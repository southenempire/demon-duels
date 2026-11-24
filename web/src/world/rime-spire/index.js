import { coverZones, herald, inside, spawn, surfaceAt } from './layout.js';
import { buildSpire } from './scenery.js';
import { createTracks } from './tracks.js';

const intel = [
  { id: 'c4.intel.1', pos: { x: -9.5, y: 0, z: 6.1 }, text: 'Frozen hymn: “The Herald waits. It keeps its Ward up.”' },
  { id: 'c4.intel.2', pos: { x: -5.85, y: 4.85, z: -3.6 }, text: 'Cracked bell plate: “Curses melt in its cold. It rarely casts Hex.”' },
  { id: 'c4.intel.3', pos: { x: -4.65, y: 0, z: -10.3 }, text: 'Frostbitten hunter: “Rend shatters the guard. Be the one who moves.”' },
];

const story = {
  codex: 'No bell has rung here since the world was young. The Herald keeps a winter so cold that time has stopped. Snow remembers every step, and the ice forgives none. Only the stone paths keep their silence.',
  enter: ['Here, time froze. Even your footprints wait to be followed.', 'Then I’ll stay on the stone.'],
  stalk: ['Be still. Nothing has moved here in an age.', 'Footprints. In my snow. Follow them.', 'The bell is silent. It will ring for you.'],
  alerted: 'Stop. Forever.',
  strike: ['Be still. Eternity will not hurt for long.', 'Your winter ends tonight.'],
  clear: ['The bell rings once. The last seal begins to fracture.', 'A fifth rune. Your name is one breath from whole.'],
  lost: ['Still. Good. Stay that way.', 'Ice cracks. So will you.'],
};

const tracks = createTracks();
let drawTracks, showIntel;
let drawnTail, drawnLength = 0;

export const FROST_HERALD = {
  id: 4,
  opponentKind: 4,
  name: 'Rime Spire',
  chapter: 'Circle V · The Last Winter',
  objective: 'Stay on stone. Climb the west roofs and strike the Frost Herald from the flank.',
  spawn,
  boss: {
    name: 'Frost Herald', model: 'frost-herald.glb', height: 3,
    pos: herald, facing: Math.PI,
  },
  patrols: [
    { route: [[-4.1, 8.8], [-1.5, 8.8], [-1.5, 6.1], [-4.1, 6.1]], facing: -Math.PI / 2 },
    { route: [[6.05, 6.5], [8.15, 6.5], [8.15, 1.9], [4.45, 1.9], [4.45, 6.5]], facing: -Math.PI / 2 },
    { route: [[-1.4, -5.15], [2.4, -5.15], [2.4, -7.8], [-1.4, -7.8]], facing: -Math.PI / 2 },
  ],
  palette: { background: 0x687e9b },
  fog: { color: 0x92aabe, density: .037 },
  audio: { ambient: 'amb-circle-4', footstep: false },
  intel,
  copy: {
    enter: story.enter.join(' '),
    seen: story.stalk[0],
    alerted: story.alerted,
    strike: story.strike.join(' '),
    victory: story.clear.join(' '),
    defeat: story.lost.join(' '),
    roof: 'Above the thralls — the bell is still silent.',
    hidden: 'Hidden in the ice cave.',
    reset: 'Caught. Your footprints give you away — stay on the stone path.',
  },
  tells: { ghost: [intel[0].text, intel[1].text], shadow: [intel[2].text], exposed: [] },
  codex: story.codex,
  scenery(T, scene) {
    tracks.reset();
    const { drawTracks: draw, showIntel: read, ...geometry } = buildSpire(T, scene, intel);
    drawTracks = draw;
    showIntel = read;
    drawnTail = undefined;
    drawnLength = 0;
    return geometry;
  },
  hooks: {
    speedAt(pos) {
      return surfaceAt(pos) === 'ice' ? 1.3 : 1;
    },
    tractionAt(pos) {
      return surfaceAt(pos) === 'ice' ? .18 : 1;
    },
    concealedAt(pos) {
      const height = pos.y ?? 0;
      return height > 2.35 || (height < 1.8 && coverZones.some((zone) => inside(pos, zone)));
    },
    onStep(pos) {
      tracks.onStep(pos);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('demon-duels:audio', {
          detail: { circle: 4, cue: surfaceAt(pos) === 'snow' ? 'step-snow' : 'step-stone' },
        }));
      }
    },
    interactionAt(pos) {
      showIntel?.(intel.find(({ pos: scroll }) =>
        Math.abs((pos.y ?? 0) - scroll.y) < .8 && Math.hypot(pos.x - scroll.x, pos.z - scroll.z) < 1.7)?.id);
      return null;
    },
    investigateTargets(time) {
      const active = tracks.at(time);
      const tail = active.at(-1);
      if (drawnTail !== tail || drawnLength !== active.length) {
        drawTracks?.(active);
        drawnTail = tail;
        drawnLength = active.length;
      }
      return active.map(({ pos, until }) => ({ pos, until }));
    },
  },
};
