const paths = {
  skull: '<path d="M18 15.5V19h-2v2H8v-2H6v-3.5a8 8 0 1 1 12 0Z"/><path d="M9 12h.01M15 12h.01M11 16h2"/>',
  blade: '<path d="M3 3h5l13 13-5 5L3 8V3Zm13 13 5-5M11 21l10-10"/>',
  rend: '<path d="m4 19 6-14m-1 16 6-17m0 16 5-14"/>',
  ward: '<path d="M12 22s8-3.5 8-11V6l-8-3-8 3v5c0 7.5 8 11 8 11Z"/><path d="m9 12 2 2 4-5"/>',
  hex: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  spark: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  cross: '<path d="m6 6 12 12M18 6 6 18"/>',
  outside: '<path d="M14 4h6v6m0-6-9 9"/><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m19 0v-2a4 4 0 0 0-3-4"/><circle cx="9.5" cy="7" r="4"/><path d="M17 3a4 4 0 0 1 0 8"/>',
  wallet: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M21 10h-5a2 2 0 0 0 0 4h5m-5-2h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v6m0-9h.01"/>',
  box: '<path d="m3 8 9-5 9 5v9l-9 5-9-5V8Zm0 0 9 5 9-5m-9 5v9m-4-16 9 5"/>',
  volume: '<path d="M3 9v6h4l5 4V5L7 9H3Zm13 0a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10"/>',
  mute: '<path d="M3 9v6h4l5 4V5L7 9H3Zm13 1 5 5m0-5-5 5"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="m13 7-4 5h3l-1 5 4-6h-3l1-4Z"/>',
};

export const icon = (name, size = 18) => '<svg aria-hidden="true" width="' + size + '" height="' + size +
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
  paths[name] + '</svg>';
