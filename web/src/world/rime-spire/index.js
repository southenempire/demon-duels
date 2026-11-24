import { bounds, coverZones, herald, inside, spawn, surfaceAt } from './layout.js';
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
let drawTracks;
let drawnTail, drawnLength = 0;

const RIME_SPIRE = {
  id: 4,
  opponentKind: 4,
  name: 'Rime Spire',
  chapter: 'Circle V · The Last Winter',
  objective: 'Stay on stone. Climb the west roofs and strike the Frost Herald from the flank.',
  spawn,
  bounds,
  boss: {
    name: 'Frost Herald', model: 'frost-herald.glb', height: 3,
    pos: herald, facing: Math.PI,
    patrol: [[1.4, -10.6], [1.4, -12.4], [2.6, -12.4], [2.6, -10.6]],
  },
  patrols: [
    { route: [[-4.1, 8.8], [-1.5, 8.8], [-1.5, 6.1], [-4.1, 6.1]], facing: -Math.PI / 2 },
    { route: [[6.05, 6.5], [8.15, 6.5], [8.15, 1.9], [4.45, 1.9], [4.45, 6.5]], facing: -Math.PI / 2 },
    { route: [[-1.4, -5.15], [2.4, -5.15], [2.4, -7.8], [-1.4, -7.8]], facing: -Math.PI / 2 },
  ],
  palette: { background: 0x687e9b, exposure: 1.04, cone: 0xe9ae71 },
  fog: { color: 0x92aabe, density: .037 },
  audio: { ambience: 'amb-circle-4', footstep: 'step-stone', footsteps: { stone: 'step-stone', snow: 'step-snow', ice: 'step-stone' } },
  intel,
  story,
  scenery(T, scene) {
    tracks.reset();
    const { drawTracks: draw, ...geometry } = buildSpire(T, scene, intel);
    drawTracks = draw;
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
      return (pos.y ?? 0) < 1.8 && coverZones.some((zone) => inside(pos, zone));
    },
    onStep(pos) {
      tracks.onStep(pos);
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

export default RIME_SPIRE;
