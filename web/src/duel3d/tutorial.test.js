import test from 'node:test';
import assert from 'node:assert/strict';
import { createTutorialGate, tutorialBeats, tutorialKey, tutorialRules } from './tutorial.js';

test('tutorial teaches the shared matchup cycle and demos the three melee beats without a capture', () => {
  assert.deepEqual(tutorialRules, ['Rend beats Ward', 'Ward beats Hex', 'Hex beats Rend']);
  assert.deepEqual(tutorialBeats.map(({ frame }) => frame.label), ['HAND BLOCK', 'PARRY', 'COUNTER KILL']);
  assert.deepEqual(tutorialBeats.map(({ frame }) => frame.actions), [
    ['strike', 'block'], ['strike', 'parry'], ['counter', 'death'],
  ]);
});

test('first chain or PvP request waits until Skip or Continue, then resumes once with the original details', () => {
  for (const mode of ['chain', 'pvp']) {
    let done;
    const writes = [];
    const storage = {
      getItem: (key) => writes.find(([stored]) => key === stored)?.[1],
      setItem: (...entry) => writes.push(entry),
    };
    const gate = createTutorialGate(storage, (finish) => { done = finish; });
    const launch = { mode, room: 'room', join: true, opponentKind: 0, grade: 'shadow' };
    const calls = [];
    const resume = () => calls.push(launch);
    assert.equal(gate.defer('practice', resume), false);
    assert.equal(gate.defer(mode, resume), true);
    assert.equal(gate.active, true);
    assert.equal(gate.defer(mode, () => assert.fail('replaced the pending launch')), true);
    assert.deepEqual(calls, []);
    assert.deepEqual(writes, []);
    done();
    done();
    assert.equal(gate.active, false);
    assert.deepEqual(calls, [launch]);
    assert.deepEqual(writes, [[tutorialKey, '1']]);
    assert.equal(createTutorialGate(storage, () => assert.fail('shown again')).defer(mode, resume), false);
  }
});

test('skipping still suppresses the automatic tutorial for the session when the flag cannot be saved', () => {
  let skip;
  const gate = createTutorialGate({
    getItem() { throw new Error('unavailable'); },
    setItem() { throw new Error('unavailable'); },
  }, (finish) => { skip = finish; });
  assert.equal(gate.defer('chain', () => {}), true);
  skip();
  assert.equal(gate.defer('pvp', () => {}), false);
});
