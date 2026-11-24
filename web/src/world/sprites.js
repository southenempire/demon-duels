import { characterArt } from '../characters.js';
import { levels } from './levels.js';
import { animations } from './presence.js';

export const sprites = {
  hunter: Object.fromEntries(Object.keys(animations).map((animation) => [animation, 'world/hunter/' + animation + '.png'])),
  sentry: null,
  circles: levels.map((_, kind) => ({
    floor: null,
    wall: null,
    cover: null,
    boss: characterArt(kind),
  })),
};
