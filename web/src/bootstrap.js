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
  document.getElementById('app').innerHTML = '<div class="boot-screen" role="alert"><strong>THE GATES ARE SILENT</strong><small>The arena could not load. Check your connection and try again.</small><button type="button" id="boot-retry">Try again</button></div>';
  document.getElementById('boot-retry').addEventListener('click', () => location.reload());
  console.error(error);
});
