import { moves, resolve } from '../rules.js';
import { meleeTimeline } from './timeline.js';

export const tutorialKey = 'demon-duels:combat-tutorial-seen';
export const tutorialRules = moves.map(({ name, beats }) => `${name} beats ${beats}`);

const move = (name) => moves.findIndex((entry) => entry.name === name);
const sample = (first, second) => meleeTimeline(resolve(move(first), move(second), [255, 255, 0]));
export const tutorialBeats = [
  { frame: sample('Ward', 'Ward')[1], caption: 'Ward can catch a strike with a hand block.' },
  { frame: sample('Rend', 'Ward')[1], caption: 'A parry deflects the blow, but Rend still has the matchup advantage over Ward.' },
  { frame: sample('Hex', 'Rend').find(({ stage }) => stage === 'counter'), caption: 'Hex outplays Rend. The winning hunter finishes with a counter.' },
];

export function createTutorialGate(storage, show) {
  let seen = false, active = false;
  const open = (resume) => {
    if (active) return false;
    active = true;
    let finished = false;
    show(() => {
      if (finished) return;
      finished = true;
      active = false;
      seen = true;
      try { storage.setItem(tutorialKey, '1'); } catch {}
      resume();
    });
    return true;
  };
  return {
    get active() { return active; },
    defer(mode, resume) {
      if (mode !== 'chain' && mode !== 'pvp') return false;
      if (active) return true;
      try { seen ||= storage.getItem(tutorialKey) === '1'; } catch {}
      return !seen && open(resume);
    },
    replay: open,
  };
}
