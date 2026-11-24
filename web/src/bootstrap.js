import { Buffer } from 'buffer';

globalThis.Buffer ??= Buffer;
import('./main.js').catch((error) => {
  document.getElementById('app').textContent = 'The arena could not load. Refresh to try again.';
  console.error(error);
});
