import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { figure } from './figures.js';

test('disposing a peer releases its meshes and cloth texture but keeps shared geometries', (t) => {
  const original = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        putImageData() {},
      }),
    }),
  };
  t.after(() => {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  });
  const scene = new Scene();
  const peer = figure(scene, 'hunter');
  const other = figure(scene, 'hunter');
  const shared = new Set();
  other.root.traverse(({ geometry }) => { if (geometry) shared.add(geometry); });
  const expected = new Map();
  peer.root.traverse(({ geometry, material }) => {
    if (!geometry) return;
    expected.set(geometry, shared.has(geometry) ? 0 : 1);
    expected.set(material, 1);
    if (material.map) expected.set(material.map, 1);
  });
  const disposed = new Map();
  for (const resource of expected.keys()) resource.addEventListener('dispose', () => {
    disposed.set(resource, (disposed.get(resource) ?? 0) + 1);
  });
  peer.dispose();
  assert.deepEqual(scene.children, [other.root]);
  for (const [resource, count] of expected) assert.equal(disposed.get(resource) ?? 0, count);
});
