import { Buffer } from 'buffer';

globalThis.Buffer ??= Buffer;
import('./main.js').catch((error) => {
  document.getElementById('app').innerHTML = '<div class="boot-screen" role="alert"><strong>THE GATES ARE SILENT</strong><small>The arena could not load. Check your connection and try again.</small><button type="button" id="boot-retry">Try again</button></div>';
  document.getElementById('boot-retry').addEventListener('click', () => location.reload());
  console.error(error);
});
