import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const glb = readFileSync(new URL('../public/models/hunter.glb', import.meta.url));
const jsonLength = glb.readUInt32LE(12);
const model = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength));
const bin = glb.subarray(28 + jsonLength);

function data(view) {
  const { byteOffset = 0, byteLength } = model.bufferViews[view];
  return bin.subarray(byteOffset, byteOffset + byteLength);
}

test('hunter is a single uncompressed, textured skin within Ash Gate budgets', () => {
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);
  assert.ok(glb.length <= 3_000_000);
  assert.equal(model.buffers.length, 1);
  assert.equal(model.buffers[0].uri, undefined);
  for (const extension of ['KHR_draco_mesh_compression', 'EXT_meshopt_compression']) {
    assert.ok(!model.extensionsUsed?.includes(extension));
  }
  assert.equal(model.meshes.length, 1);
  assert.equal(model.skins.length, 1);
  assert.equal(model.nodes.filter(n => n.mesh === 0 && n.skin === 0).length, 1);
  assert.equal(model.meshes[0].primitives.length, 1);
  const { attributes, indices, material } = model.meshes[0].primitives[0];
  const positions = model.accessors[attributes.POSITION];
  assert.ok(Math.abs(positions.max[1] - 1.85) < 1e-5);
  assert.equal(positions.min[1], 0);
  assert.ok(model.accessors[indices].count / 3 <= 15_000);
  assert.equal(model.accessors[attributes.JOINTS_0].count, positions.count);
  assert.equal(model.accessors[attributes.WEIGHTS_0].count, positions.count);
  const pbr = model.materials[material].pbrMetallicRoughness;
  for (const texture of [pbr.baseColorTexture, pbr.metallicRoughnessTexture]) {
    const image = model.images[model.textures[texture.index].source];
    assert.equal(image.uri, undefined);
    assert.equal(image.mimeType, 'image/png');
    const png = data(image.bufferView);
    assert.ok(png.readUInt32BE(16) <= 2048 && png.readUInt32BE(20) <= 2048);
  }
});

test('hunter includes every animated clip and only deploys its blade in attacks', () => {
  const expected = [
    'Idle', 'Guard', 'Walk', 'Run', 'Crouch', 'CrouchWalk', 'Climb', 'Strike',
    'CounterKill', 'Block', 'Parry', 'Dodge', 'HitReact', 'Death', 'Victory',
  ];
  assert.deepEqual(model.animations.map(a => a.name).sort(), expected.sort());
  const animated = (animation, joint, path) => {
    const channel = animation.channels.find(({ target }) =>
      model.nodes[target.node].name === joint && target.path === path);
    if (!channel) return false;
    const accessor = model.accessors[animation.samplers[channel.sampler].output];
    const bytes = data(accessor.bufferView);
    const components = accessor.type === 'VEC3' ? 3 : 4;
    const offset = accessor.byteOffset ?? 0;
    for (let key = 1; key < accessor.count; key++) {
      for (let axis = 0; axis < components; axis++) {
        const first = bytes.readFloatLE(offset + 4 * axis);
        const next = bytes.readFloatLE(offset + 4 * (components * key + axis));
        if (Math.abs(first - next) > 1e-5) return true;
      }
    }
    return false;
  };
  for (const animation of model.animations) {
    assert.ok(animated(animation, 'Chest', 'rotation'), animation.name);
    assert.equal(animated(animation, 'Blade', 'translation'),
      ['Strike', 'CounterKill'].includes(animation.name), animation.name);
  }
});
