import { Buffer } from 'buffer';
import { isAshGate } from './route.js';

globalThis.Buffer ??= Buffer;
const params = new URLSearchParams(location.search);
import('./main.js').then(async ({ hasAshSeal, setExploring }) => {
  if (!isAshGate(params)) return;
  try {
    const { mountAshGate } = await import('./ash-gate/index.js');
    mountAshGate({ hasAshSeal, setExploring });
  } catch (error) {
    const notice = document.createElement('p');
    notice.setAttribute('role', 'status');
    notice.textContent = 'Ash Gate needs a browser with WebGL 2. You can still play in the arena below.';
    document.getElementById('app').before(notice);
    console.error(error);
  }
}).catch((error) => {
  document.getElementById('app').textContent = 'The arena could not load. Refresh to try again.';
  console.error(error);
});
