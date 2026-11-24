import { characterArt } from '../characters.js';
import { levels } from './levels.js';

export const sprites = {
  hunter: null,
  sentry: null,
  circles: levels.map((_, kind) => ({
    floor: null,
    wall: null,
    cover: null,
    boss: characterArt(kind),
  })),
};
