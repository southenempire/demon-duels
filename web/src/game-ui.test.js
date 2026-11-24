import test from 'node:test';
import assert from 'node:assert/strict';
import { installDialogKeys, worldHud, duelHud, movePicker, vaultPanel, storyPanel, titleScreen } from './game-ui.js';

function dialogHarness() {
  let listener;
  const doc = { activeElement: {}, addEventListener: (name, fn) => { listener = fn; } };
  const control = () => ({ getClientRects: () => [{}], focus() { doc.activeElement = this; } });
  const controls = [control(), control()];
  let visible = true;
  const dialog = {
    getClientRects: () => visible ? [{}] : [],
    querySelectorAll: () => controls,
    contains: (element) => controls.includes(element),
  };
  installDialogKeys({ ownerDocument: doc, querySelector: () => dialog });
  return {
    doc, controls,
    hide: () => { visible = false; },
    tab: (shiftKey = false) => {
      let prevented = false;
      listener({ key: 'Tab', shiftKey, preventDefault() { prevented = true; } });
      return prevented;
    },
  };
}

test('Tab recovers dialog focus after a busy rerender sends focus to body', () => {
  const h = dialogHarness();
  assert.equal(h.tab(), true);
  assert.equal(h.doc.activeElement, h.controls[0]);
  h.doc.activeElement = {}; // The previously focused Refresh button was removed.
  assert.equal(h.tab(true), true);
  assert.equal(h.doc.activeElement, h.controls[1]);
});

test('Tab wraps at both dialog boundaries without trapping an internal Tab', () => {
  const h = dialogHarness();
  h.doc.activeElement = h.controls[0];
  assert.equal(h.tab(), false);
  assert.equal(h.tab(true), true);
  assert.equal(h.doc.activeElement, h.controls[1]);
  assert.equal(h.tab(), true);
  assert.equal(h.doc.activeElement, h.controls[0]);
});

test('hidden game surfaces do not trap the active world keyboard', () => {
  const h = dialogHarness();
  h.hide();
  assert.equal(h.tab(), false);
});

test('3D move overlay preserves the three chain action IDs and sealed state', () => {
  const html = movePicker({ selected: 1, locked: true });
  assert.deepEqual([...html.matchAll(/data-action="(move:\d)"/g)].map((match) => match[1]), ['move:0', 'move:1', 'move:2']);
  assert.equal((html.match(/ disabled/g) || []).length, 3);
  assert.match(html, /data-action="move:1" aria-pressed="true" disabled/);
  assert.match(html, /Rend<\/b><small>BEATS Ward/);
  assert.match(html, /Ward<\/b><small>BEATS Hex/);
  assert.match(html, /Hex<\/b><small>BEATS Rend/);
});

test('world overlays bound meters and retain agreed interaction hooks', () => {
  const html = worldHud({ health: -5, seals: 99, awareness: 'alert', hunters: 2, prompt: { key: 'E', label: 'Strike' }, objective: 'Find the gate' });
  assert.match(html, /aria-valuenow="0"/);
  assert.match(html, /6 \/ 6 SEALS BROKEN/);
  assert.match(html, /data-state="alert"/);
  for (const action of ['pause', 'exit', 'strike']) assert.match(html, new RegExp(`data-hunt="${action}"`));
  assert.match(html, /data-objective/);
  assert.match(html, /2 HUNTERS NEARBY/);
  assert.doesNotMatch(duelHud({ player: { name: 'Hunter' }, phase: 'clash' }), /role="meter"/);
  assert.match(duelHud({ phase: 'clash' }), /THE CLASH/);
});

test('overlay text cannot inject markup or attributes, and title leaves art to the 3D renderer', () => {
  const injected = '\"><img src=x onerror=alert(1)>';
  for (const html of [storyPanel({ speaker: injected, text: injected }), vaultPanel({ cards: [{ id: injected, name: injected, type: injected }] }), worldHud({ objective: injected })]) {
    assert.doesNotMatch(html, /<img src=x/);
    assert.match(html, /&lt;img/);
  }
  assert.doesNotMatch(titleScreen(), /title-hunter|title-landscape|<img|<canvas/);
});

test('the world HUD places the campaign seal count before the objective', () => {
  const html = worldHud({ location: 'Gloam', seals: 5, objective: 'Find the Gloam Shade' });
  assert.match(html, /dd-world-summary.*5 \/ 6 SEALS BROKEN.*dd-objective.*Find the Gloam Shade.*<nav/s);
});

test('Ash Gate HUD exposes delegated actions and escapes the live hunter name', () => {
  const hunt = (prompt) => worldHud({ objective: 'Find the Warden', awareness: 'suspicious', hunters: 2, prompt });
  const strike = hunt({ key: 'E', label: 'Strike Ash Warden' });
  assert.match(strike, /data-hunt="strike"/);
  assert.match(strike, /data-hunt="pause".*data-hunt="exit"/s);
  assert.match(strike, /data-objective>Find the Warden/);
  assert.match(strike, /data-state="suspicious"/);
  assert.match(strike, /2 HUNTERS NEARBY/);
  assert.match(hunt({ key: 'Space', label: 'Climb' }), /<div class="dd-context-prompt"><kbd>Space/);
  assert.match(hunt({ key: 'F', label: 'Challenge <hunter>', action: 'challenge' }), /data-hunt="challenge"><kbd>F<\/kbd> Challenge &lt;hunter&gt;/);
});
