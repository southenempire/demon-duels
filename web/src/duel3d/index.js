import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createFighter, disposeTree } from './fighter.js';
import { buildStage } from './stage.js';
import { meleeActions } from './timeline.js';

const assets = import.meta.env.BASE_URL + 'models/';
const smooth = (n) => T.MathUtils.smoothstep(n, 0, 1);

export function mount(container, roundData) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true }); }
  catch { return null; }
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, .1, 48);
  const loader = new GLTFLoader();
  const light = buildStage(scene);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
  const sparks = [];
  const sparkGeometry = new T.BoxGeometry(.025, .025, .16);
  const sparkMaterial = new T.MeshBasicMaterial({ color: 0xffcb70 });
  for (let i = 0; i < 23; i++) {
    const spark = new T.Mesh(sparkGeometry, sparkMaterial);
    spark.visible = false; scene.add(spark); sparks.push(spark);
  }
  const sparkLight = new T.PointLight(0xff9148, 0, 3.8);
  scene.add(sparkLight);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const v = new T.Vector3(), contact = new T.Vector3();
  let frameId, frameStart = performance.now(), activeFrame, fighters = [], keys = [], width = 0, height = 0;
  let data;
  function attach(host) {
    if (host.firstChild !== canvas) host.replaceChildren(canvas);
  }
  function update(next) {
    data = next;
    if (data.frame !== activeFrame) {
      activeFrame = data.frame;
      frameStart = performance.now();
    }
    data.fighters.forEach((fighter, index) => {
      const key = fighter && [fighter.role, fighter.color, fighter.size].join(':');
      if (keys[index] === key) return;
      fighters[index]?.dispose();
      fighters[index] = fighter ? createFighter(scene, loader, assets, fighter) : null;
      keys[index] = key;
    });
  }
  function render(now) {
    frameId = requestAnimationFrame(render);
    if (!canvas.isConnected) return;
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    if (clientWidth !== width || clientHeight !== height) {
      width = clientWidth; height = clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
    }
    const time = now / 1000;
    const frame = data.frame;
    const p = !frame ? 0 : reduced.matches ? .54 : Math.min(1, (now - frameStart) / (frame.duration || 100));
    const progress = frame?.stage === 'counter' && !reduced.matches ? p < .4 ? p * 1.15 :
      p < .72 ? .46 + (p - .4) * .31 : .56 + (p - .72) * (.44 / .28) : p;
    const actions = meleeActions(frame, data.result);
    const counter = frame?.stage === 'counter';
    const exchange = frame?.stage === 'exchange';
    const approach = counter ? smooth(progress / .32) : exchange ?
      smooth(progress / .43) * (1 - smooth((progress - .63) / .37)) : 0;
    const idle = !exchange && !counter && !['spoils', 'finish'].includes(frame?.stage);
    const circle = idle && !reduced.matches ? Math.sin(time * 1.5) * .33 : 0;
    const parry = frame?.label === 'PARRY';
    const handContact = parry || frame?.label === 'HAND BLOCK';
    const distance = counter || ['spoils', 'finish'].includes(frame?.stage) ? 1.08 : 1.64 - approach * (handContact ? .94 : .74);
    const contactY = Math.min(data.fighters[0]?.size ?? 1.85, data.fighters[1]?.size ?? 1.85) * .88;
    contact.set(counter ? (frame.attacker ? -.57 : .57) : 0, contactY, parry ? .58 * smooth((progress - .46) / .29) : .08);
    fighters.forEach((fighter, side) => {
      if (!fighter) return;
      const sign = side ? 1 : -1;
      const action = actions[side];
      const step = action === 'dodge' ? approach * .78 : 0;
      fighter.root.position.set(sign * (distance + (action === 'hit' ? .23 * approach : 0)) -
        (counter && frame.attacker === side ? sign * .44 * approach : 0), 0, sign * (circle - step));
      fighter.root.rotation.y = -sign * Math.PI / 2 - circle * .5;
      fighter.pose(action, progress, time, reduced.matches, handContact || counter ? contact : null);
      if (handContact) fighter.alignHands(action, contact,
        .87 * smooth((progress - .23) / .18) * (1 - smooth((progress - .63) / .22)));
    });
    const close = counter && !reduced.matches ? smooth(p / .22) * (1 - smooth((p - .8) / .2)) : 0;
    const bias = counter ? (frame.attacker ? 1 : -1) : 0;
    const narrow = Math.max(0, 1.55 - camera.aspect) * 3.5;
    camera.position.set(-.35 + close * bias * 1.15, 2.45 - close * .37, 6.95 + narrow - close * 2.15);
    camera.lookAt(close * bias * .31, 1.43, 0);
    light(time);
    const hit = (counter || exchange && frame.label !== 'DODGE') && progress >= .44 && progress < .71;
    const burst = (progress - .44) / .27;
    sparks.forEach((spark, i) => {
      spark.visible = hit && !reduced.matches;
      if (!spark.visible) return;
      const a = i * 2.39996;
      spark.position.set(contact.x + Math.sin(a) * burst * (1.5 + i % 3 * .3),
        contact.y + Math.cos(a) * burst * 1.1 - burst ** 2 * .3, contact.z + Math.sin(i * 3.11) * burst);
      spark.rotation.set(a, i, a + burst);
      spark.scale.setScalar(1 - burst * .8);
    });
    sparkLight.position.copy(contact);
    sparkLight.intensity = hit && !reduced.matches ? 12 * (1 - burst) : 0;
    renderer.render(scene, camera);
  }
  canvas.addEventListener('webglcontextlost', onLost);
  function onLost(event) {
    event.preventDefault();
    const callback = data.onUnavailable;
    dispose();
    callback?.();
  }
  function dispose() {
    cancelAnimationFrame(frameId);
    canvas.removeEventListener('webglcontextlost', onLost);
    for (const fighter of fighters) fighter?.dispose();
    scene.traverse((item) => { if (item.isLight && item.shadow) item.shadow.dispose(); });
    disposeTree(scene);
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }
  attach(container);
  update(roundData);
  frameId = requestAnimationFrame(render);
  return { attach, update, dispose, fighterPoint(side) {
    if (!fighters[side] || !width) return null;
    v.copy(fighters[side].root.position);
    v.y = .9;
    v.project(camera);
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 };
  } };
}
