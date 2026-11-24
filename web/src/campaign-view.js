import { circles, circleState, pitUnlocked } from './campaign.js';
import { demons } from './rules.js';
import { icon } from './icons.js';
import './campaign.css';

const art = import.meta.env.BASE_URL + 'art/campaign/';
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const portrait = (id, cls = '') => '<img class="' + cls + '" src="' + art + circles[id].slug + '.webp" alt="' + demons[id].name + '" draggable="false">';
const navButton = (action, label, active, extra = '') => '<button type="button" data-action="' + action + '" class="journey-tab' + (active ? ' active' : '') + '"' + (active ? ' aria-current="page"' : '') + '>' + label + extra + '</button>';

export function journeyNav(view, progress) {
  return '<nav class="journey-nav" aria-label="Game modes">' + navButton('map', 'The descent', view === 'map') +
    navButton('codex', 'Demon codex', view === 'codex') + navButton('pit', 'The open pit', view === 'pit', pitUnlocked(progress) ? '' : icon('lock', 12)) + '</nav>';
}

export function storyView(button) {
  return '<section class="story-opening" aria-labelledby="story-title"><div class="story-copy"><span class="eyebrow">A SOUL. SIX GUARDIANS. ONE WAY OUT.</span>' +
    '<h1 id="story-title">THE UNDERWORLD<br>DOESN’T GIVE.<br><em>IT TAKES.</em></h1><p class="story-lead">You woke at the gates with nothing but a demon at your side.</p>' +
    '<p>Six guardians stand between you and the heart of the Underworld. Defeat them, claim their cards, and earn your place in the open pit.</p>' +
    '<div class="actions">' + button('begin', 'Begin the descent', 'primary', 'arrow') + button('practice', 'Learn to duel', 'secondary', 'blade') + '</div>' +
    '<div class="story-footnote">SOLANA DEVNET · NO PURCHASE NEEDED<br>Real card ownership. Test tokens only.</div></div>' +
    '<div class="story-art" aria-label="The Underworld guardians"><div class="story-orbit"></div><span class="story-rune rune-one">VI</span><span class="story-rune rune-two">I</span>' +
    portrait(1, 'story-wraith') + portrait(0, 'story-warden') + '<div class="story-art-caption"><span>THE CINDER GATE</span><b>Your descent begins here.</b></div></div></section>' +
    '<section class="journey-steps" aria-label="Your quest"><div><span>01</span><b>Claim your first demons</b><p>Open a free, random starter pack.</p></div><div><span>02</span><b>Break the six seals</b><p>Risk one card. Win the guardian’s.</p></div><div><span>03</span><b>Rule the open pit</b><p>Challenge players. Build your collection.</p></div></section>';
}

function mapTerrain(progress) {
  const points = circles.map((c) => c.x * 7 + ',' + c.y * 6).join(' ');
  return '<svg class="map-terrain" viewBox="0 0 700 600" preserveAspectRatio="none" aria-hidden="true"><defs><radialGradient id="land"><stop stop-color="#42343a"/><stop offset="1" stop-color="#191620"/></radialGradient><pattern id="contours" width="110" height="90" patternUnits="userSpaceOnUse"><path d="M-20 60Q30 0 70 30T140 0M-20 70Q30 10 70 40T140 10M-20 80Q30 20 70 50T140 20" fill="none" stroke="#b7a38a" stroke-opacity=".07"/></pattern></defs>' +
    '<path d="M70 540 35 434 86 367 42 275 98 197 77 110 185 46 279 65 362 25 459 68 586 38 625 137 587 227 649 297 604 402 622 489 516 551 407 526 310 574 208 537Z" fill="url(#land)" stroke="#7b645a" stroke-opacity=".3"/>' +
    '<path d="M70 540 35 434 86 367 42 275 98 197 77 110 185 46 279 65 362 25 459 68 586 38 625 137 587 227 649 297 604 402 622 489 516 551 407 526 310 574 208 537Z" fill="url(#contours)"/>' +
    '<path d="M290 540Q260 460 330 417T410 320Q450 270 377 211T320 90" fill="none" stroke="#786779" stroke-opacity=".12" stroke-width="17"/>' +
    '<g fill="none" stroke="#9a859b" stroke-opacity=".18" stroke-width="1.5"><path d="m66 324 27-48 31 48-11-7-20-27-14 29ZM510 190l28-53 33 53-20-9-13-28-15 30ZM476 454l35-63 36 63-22-13-14-33-18 33ZM253 121l24-44 29 44-18-8-11-22-11 25Z"/><circle cx="350" cy="300" r="238" stroke-dasharray="3 12"/><path d="M330 43h40m-20-20v40M330 557h40m-20-20v40"/></g>' +
    '<polyline points="' + points + '" fill="none" stroke="#09080e" stroke-width="6"/><polyline points="' + points + '" fill="none" stroke="#b09a7e" stroke-opacity=".58" stroke-width="1.5" stroke-dasharray="4 7"/>' +
    (progress.wins.length > 0 ? '<polyline points="' + circles.slice(0, Math.min(progress.wins.length + 1, 6)).map((c) => c.x * 7 + ',' + c.y * 6).join(' ') + '" fill="none" stroke="#eeb88d" stroke-width="2"/>' : '') + '</svg>';
}

export function mapView(progress, selected, button, activeRoom = false) {
  const count = progress.wins.length;
  const c = circles[selected];
  const state = circleState(progress, selected);
  const done = pitUnlocked(progress);
  return journeyNav('map', progress) + '<section class="journey-heading"><div><span class="eyebrow">STORY CAMPAIGN / CHAPTER ' + (done ? 'COMPLETE' : roman[count]) + '</span><h1>THE SIX <em>CIRCLES</em></h1><p>' +
    (done ? 'You broke every seal. The open pit is yours to enter.' : 'Descend through the Underworld. Defeat its guardians. Claim their power.') + '</p></div><div class="seal-progress"><b>' + count + '<span> / 6</span></b><span>SEALS BROKEN</span><div class="seal-dots" aria-label="' + count + ' of 6 circles conquered">' + circles.map((_, i) => '<i class="' + (i < count ? 'lit' : '') + '"></i>').join('') + '</div></div></section>' +
    (activeRoom ? '<div class="journey-resume"><span>You have a duel in progress. Your stake is waiting.</span>' + button('resume', 'Resume duel', 'secondary', 'arrow') + '</div>' : '') +
    '<div class="journey-layout"><section class="underworld-map" aria-label="Map of the six circles">' + mapTerrain(progress) +
    '<span class="map-compass">✦<small>THE DESCENT</small></span><span class="map-note">NO SOUL RETURNS UNCHANGED</span>' + circles.map((circle) => {
      const status = circleState(progress, circle.id);
      return '<button type="button" class="circle-node ' + status + (selected === circle.id ? ' selected' : '') + '" style="--x:' + circle.x + '%;--y:' + circle.y + '%;--realm:' + circle.color + '" data-action="circle:' + circle.id + '" aria-pressed="' + (selected === circle.id) + '" aria-label="Circle ' + roman[circle.id] + ': ' + circle.realm + ', ' + status + '"><span class="node-seal">' + (status === 'conquered' ? icon('ward', 22) : status === 'locked' ? icon('lock', 18) : icon('blade', 22)) + '</span><span class="node-label"><small>CIRCLE ' + roman[circle.id] + '</small><b>' + circle.realm + '</b></span></button>';
    }).join('') + '<div class="map-legend"><span><i></i> YOUR NEXT DUEL</span><span>' + icon('lock', 11) + ' SEALED</span><span>' + icon('ward', 12) + ' CONQUERED</span></div></section>' +
    '<aside class="boss-briefing" style="--realm:' + c.color + '"><div class="boss-portrait">' + portrait(selected) + '<span class="boss-circle">' + roman[selected] + '</span><span class="realm-tag">' + (state === 'locked' ? 'SEALED CIRCLE' : state === 'conquered' ? 'GUARDIAN DEFEATED' : 'YOUR NEXT GUARDIAN') + '</span></div>' +
    '<div class="boss-copy"><span class="eyebrow">' + c.epithet + '</span><h2>' + demons[selected].name + '</h2><p>' + c.story + '</p><blockquote>' + c.quote + '</blockquote>' +
    '<div class="boss-reward">' + icon('box', 20) + '<span><small>VICTORY REWARD</small><b>' + demons[selected].name + ' card</b></span></div>' +
    (activeRoom ? button('resume', 'Finish your current duel', 'primary', 'arrow') : state === 'locked' ? '<p class="locked-copy">' + icon('lock', 13) + ' Defeat ' + demons[selected - 1].name + ' to reach this circle.</p>' :
      button('boss:' + selected, state === 'conquered' ? 'Challenge again' : 'Enter this circle', 'primary', 'blade')) +
    '<small class="stake-note">Real devnet duel against a bot. Choose your card next; the winner keeps both. Losing does not erase your progress.</small></div></aside></div>' +
    '<section class="pit-gateway ' + (done ? 'unlocked' : '') + '"><div class="pit-gateway-icon">' + icon(done ? 'blade' : 'lock', 25) + '</div><div><span class="eyebrow">BEYOND THE SIX CIRCLES</span><h2>The open pit</h2><p>' + (done ? 'No guardians. No mercy. Challenge other players for their demons.' : 'Break all six seals to unlock player-vs-player duels.') + '</p></div>' + (done ? button('pit', 'Enter the pit', 'primary', 'arrow') : '<span class="pit-remaining">' + (6 - count) + ' SEALS REMAIN</span>') + '</section>' +
    '<div class="journey-learning"><span>New to the Underworld? Learn Rend, Ward and Hex without risking a card.</span>' + button('practice', 'Practice duel', 'text', 'blade') + '</div>';
}

export function codexView(progress) {
  return journeyNav('codex', progress) + '<section class="journey-heading"><div><span class="eyebrow">THE GUARDIANS OF THE UNDERWORLD</span><h1>DEMON <em>CODEX</em></h1><p>Your record of conquered circles. Current card ownership lives in your vault.</p></div></section><section class="codex-grid" aria-label="Guardian collection">' + circles.map((c) => {
    const conquered = circleState(progress, c.id) === 'conquered';
    return '<article class="codex-card ' + (conquered ? 'conquered' : '') + '" style="--realm:' + c.color + '">' + portrait(c.id) + '<span class="eyebrow">CIRCLE ' + roman[c.id] + ' / ' + demons[c.id].type + '</span><h2>' + demons[c.id].name + '</h2><p>' + c.realm + '</p><span class="codex-status">' + icon(conquered ? 'ward' : 'lock', 14) + (conquered ? 'GUARDIAN CONQUERED' : 'NOT YET CONQUERED') + '</span></article>';
  }).join('') + '</section><p class="journal-note">Campaign progress is saved for this guest wallet in this browser. Practice wins never break seals. Cards can be lost in later duels.</p>';
}

export function encounterHeading(id, button) {
  const c = circles[id];
  return '<div class="encounter-heading"><div><span class="eyebrow">CIRCLE ' + roman[id] + ' / ' + c.realm + '</span><h1>' + demons[id].name + '</h1><p>Defeat the guardian to claim its card and break this seal.</p></div>' + button('map', 'Underworld map', 'secondary', 'arrow') + '</div>';
}

export function campaignResult(id, won, progress, button) {
  const next = id + 1;
  return '<section class="campaign-reward ' + (won ? 'won' : '') + '"><span class="eyebrow">' + (won ? 'GUARDIAN CONQUERED / SEAL BROKEN' : 'THE DESCENT IS NOT OVER') + '</span><h2>' + (won ? demons[id].name + ' claimed.' : 'Rise. Return. Reclaim.') + '</h2><p>' + (won ? circles[id].victory : 'Your staked card went to the guardian. Your broken seals remain. Choose another card from your vault and try again.') + '</p><div class="actions">' +
    button('campaign-return', won && pitUnlocked(progress) ? 'Enter the open pit' : won && next === progress.wins.length ? 'Continue the descent' : 'Return to the map', 'primary', 'arrow') + '</div></section>';
}
