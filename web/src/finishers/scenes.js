import { characterArt } from '../characters.js';
import { demons } from '../rules.js';

const wins = [
  ['cinder', 'Extinguish the Warden', 'The last ember dies in silence.', '<path d="M49 85 28 49 48 59 59 13 69 52 88 35 74 80Z"/><path d="m26 28-4-9m58-3 6-9m10 62 13 4M19 64 8 68"/>'],
  ['eclipse', 'Silence the Void', 'Where the Wraith stood, nothing answers.', '<circle cx="60" cy="50" r="38"/><ellipse cx="60" cy="50" rx="54" ry="17" transform="rotate(-27 60 50)"/><path d="M60 3v14m0 66v14M4 50h15m82 0h15"/>'],
  ['crown', 'Break the Bone Crown', 'The crown cracks. The dead kneel no more.', '<path d="m11 25 22 18 21-31 8 24-15 13 12 14-9 18H23Zm54 16 9-18 16 21 20-17-14 53H61l10-17-11-14Z"/><path d="m33 88 8 9m45-10-6 10"/>'],
  ['miasma', 'Drain the Mire', 'The swamp takes back what it made.', '<path d="M4 64c16-20 24 17 48-4s39-18 64 0M4 80c21-15 31 15 51-2s44-17 61-1"/><circle cx="29" cy="38" r="9"/><circle cx="71" cy="22" r="12"/><circle cx="101" cy="42" r="5"/>'],
  ['shatter', 'Shatter the Herald', 'The frost breaks before it can scream.', '<path d="M60 5v90M20 27l80 46M20 73l80-46M48 14l12 13 12-13M48 86l12-13 12 13M21 43l17-6-2-17m48 60-3-17 18-6M19 56l19 7-2 17m48-61-3 18 18 6"/>'],
  ['afterlight', 'Cut the Last Light', 'One edge. The last shadow goes dark.', '<path d="m60 6 8 32 39 12-39 11-8 33-8-33L13 50l39-12Z"/><path d="m25 10 9 17-14-6m73 56 13 8-4-15M9 87l18-9M93 20l17-9"/>'],
];

export function finisherScene(detail) {
  if (detail?.mode !== 'chain' || typeof detail.duel !== 'string' || !detail.duel ||
      typeof detail.won !== 'boolean' || !Number.isInteger(detail.opponentKind)) return null;
  const kind = detail.opponentKind;
  if (!demons[kind]) return null;
  const [effect, title, line, sigil] = detail.won ? wins[kind] :
    ['fallen', 'The Hunter Falls', 'The circle keeps what you carried into it.', '<circle cx="60" cy="50" r="35"/><path d="m40 29 40 42m0-42L40 71"/>'];
  return {
    effect, title, line, sigil, color: detail.won ? demons[kind].glow : '#f48286',
    boss: demons[kind].name, circle: String(kind + 1).padStart(2, '0'),
    opening: characterArt(kind, 'idle'),
    ending: characterArt(kind, detail.won ? 'defeat' : 'attack'),
  };
}
