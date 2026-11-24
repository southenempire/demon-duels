import { demons } from './rules.js';
import manifest from './character-manifest.json' with { type: 'json' };

// The artist can replace any pose or portrait without touching the fight logic.
// Paths are relative to public/art/. Individual poses fall back to idle.
export const characters = demons.map((demon, kind) => {
  const art = manifest.characters.find((character) => character.demonId === kind);
  if (art?.name !== demon.name) throw new Error('Character manifest does not match the onchain roster');
  return {
    portrait: 'characters/' + art.portrait,
    facing: manifest.facing, hue: 0, accent: art.accent,
    poses: Object.fromEntries(Object.entries(art.poses).map(([pose, path]) => [pose, 'characters/' + path])),
  };
});

export function characterArt(kind, pose = 'idle') {
  const character = characters[kind];
  if (!character) return null;
  return character.poses[pose] || character.poses.idle;
}
