// The colors an important week can wear. Pure data — no DOM, no storage.
//
// Only the id is saved with each important week. The actual shades live in
// styles.css as `--c-<id>`, once per theme, and the `.c-<id>` class points
// `--mark` at them. Each shade was picked to stay clear of the "this week"
// color and of the lived and ahead squares in both themes.

export const COLORS = Object.freeze([
  { id: 'blue', name: 'Blue' },
  { id: 'violet', name: 'Violet' },
  { id: 'pink', name: 'Pink' },
  { id: 'red', name: 'Red' },
  { id: 'green', name: 'Green' },
  { id: 'teal', name: 'Teal' },
]);

/** The color for important weeks saved before colors existed, and the picker's first choice. */
export const DEFAULT_COLOR = 'blue';

const IDS = new Set(COLORS.map((c) => c.id));

export function isColor(id) {
  return IDS.has(id);
}

/** `id` if it is one of the colors, else the default. */
export function colorOrDefault(id) {
  return isColor(id) ? id : DEFAULT_COLOR;
}
