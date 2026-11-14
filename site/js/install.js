// Installing the site as an app: which way this browser offers, for
// Settings → Install as an app. No DOM; app.js gathers what it needs from
// the browser and shows the matching instructions.
//
// Browsers do it differently:
// - Chrome, Edge and Samsung Internet fire `beforeinstallprompt`, and the
//   page can show their install prompt from a button.
// - Safari on iPhone and iPad has Add to Home Screen in the Share menu, and
//   so do other browsers there, which are Safari underneath.
// - Safari on a Mac (17 and later) has File → Add to Dock.
// - Elsewhere, if the browser can do it at all, it is in its own menu.

/** Safari on a Mac first had Add to Dock in this version. */
export const MAC_SAFARI_SINCE = 17;

/**
 * Which way to offer:
 * - 'app':    already running as the installed app; nothing to offer
 * - 'done':   installed just now, from this page
 * - 'prompt': the browser's own install prompt, from a button
 * - 'ios':    Share → Add to Home Screen, on iPhone and iPad
 * - 'mac':    File → Add to Dock, in Safari on a Mac
 * - 'other':  look in the browser's menu
 *
 * `standalone` is whether the page is open as an installed app, `installed`
 * whether it was installed from this page, and `canPrompt` whether the
 * browser has offered its install prompt. `maxTouchPoints` tells an iPad,
 * which says it is a Mac, from a Mac.
 */
export function installWay({ standalone = false, installed = false, canPrompt = false, userAgent = '', maxTouchPoints = 0 } = {}) {
  if (standalone) return 'app';
  if (installed) return 'done';
  if (canPrompt) return 'prompt';
  if (isAppleTouch(userAgent, maxTouchPoints)) return 'ios';
  if (macSafariVersion(userAgent) >= MAC_SAFARI_SINCE) return 'mac';
  return 'other';
}

/**
 * Whether an installed app keeps its own data, apart from the browser's.
 * On iPhone, iPad and Mac it does, so it starts empty, and the weeks move
 * over through a backup. Chrome and Edge apps share the browser's.
 */
export const keepsOwnData = (way) => way === 'ios' || way === 'mac';

/** iPhone, iPod or iPad, including an iPad that asks for desktop sites (and so says it is a Mac). */
function isAppleTouch(userAgent, maxTouchPoints) {
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) return true;
  return /\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1;
}

/** Safari's version on a Mac, or 0 for any other browser. Chrome, Edge and Firefox there don't say "Version/". */
function macSafariVersion(userAgent) {
  if (!/\bMacintosh\b/.test(userAgent) || /\b(Chrome|Chromium|Edg|OPR|Firefox)\//.test(userAgent)) return 0;
  const match = /\bVersion\/(\d+)[\d.]*.*\bSafari\//.exec(userAgent);
  return match ? Number(match[1]) : 0;
}
