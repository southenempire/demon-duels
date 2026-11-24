import test from 'node:test';
import assert from 'node:assert/strict';
import { installDialogKeys } from './game-ui.js';

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
