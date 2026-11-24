import test from 'node:test';
import assert from 'node:assert/strict';
import { installDialogKeys, worldHud } from './game-ui.js';

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
