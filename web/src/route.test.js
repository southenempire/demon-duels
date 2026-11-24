import test from 'node:test';
import assert from 'node:assert/strict';
import { initialJourney, isAshGate } from './route.js';

test('the explicit standalone Pit route bypasses both Ash Gate and the campaign prologue', () => {
  const params = new URLSearchParams('world=arena');
  assert.equal(isAshGate(params), false);
  assert.equal(initialJourney(params, null), 'arena');
  assert.equal(initialJourney(params, '1'), 'arena');
});

test('Ash Gate remains the default and room invitations still open the arena', () => {
  const params = new URLSearchParams();
  assert.equal(isAshGate(params), true);
  assert.equal(initialJourney(params, null), 'story');
  assert.equal(initialJourney(params, '1'), 'map');
  params.set('room', 'invite');
  assert.equal(isAshGate(params), false);
  assert.equal(initialJourney(params, null), 'arena');
});
