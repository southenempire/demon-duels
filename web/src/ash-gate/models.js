import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function installModel(actor, file) {
  try {
    const url = new URL(import.meta.env.BASE_URL + 'models/' + file, location.href);
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.arrayBuffer();
    if (data.byteLength < 12 || new DataView(data).getUint32(0, true) !== 0x46546c67) throw new Error('Response is not a GLB');
    const { scene, animations } = await new GLTFLoader().parseAsync(data, new URL('.', url).href);
    scene.rotation.y = Math.PI;
    scene.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = node.receiveShadow = true;
      if (node.isSkinnedMesh) node.frustumCulled = false;
    });
    const mixer = new T.AnimationMixer(scene);
    const actions = new Map(animations.map((clip) => [clip.name.toLowerCase(), mixer.clipAction(clip)]));
    for (const name of ['strike', 'block', 'death']) {
      const action = actions.get(name);
      if (!action) continue;
      action.setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    let active = null;
    actor.root.add(scene);
    actor.body.visible = false;
    actor.model = {
      update(name, dt, duration) {
        const exact = actions.get(name.toLowerCase());
        const next = exact || actions.get('idle');
        if (active !== next) {
          active?.fadeOut(.13);
          next?.reset().fadeIn(.13).play();
          if (exact && duration) exact.setDuration(duration);
          active = next;
        }
        mixer.update(dt);
      },
    };
  } catch (error) {
    console.warn('Ash Gate is using a procedural stand-in for ' + file, error);
  }
}
