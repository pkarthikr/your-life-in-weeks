// How long a life the grid counts against: a country's life expectancy, or
// a number the person picks. Pure functions — no DOM, no storage — so they
// are safe to unit test.
//
// What is saved is `{ country, sex, custom }`:
//   country  a code from life-expectancy.js, or '' for none picked yet
//   sex      'both' (the average), 'male' or 'female'
//   custom   the person's own number of years, or null to use the country's
// A custom number wins; then the country's figure; then YEARS (100), which
// is what the grid showed before there was a choice.

import { YEARS, MAX_YEARS } from './weeks.js';
import { COUNTRIES, SOURCE } from './life-expectancy.js';

export { COUNTRIES, SOURCE };

export const MIN_LIFESPAN = 1;
export const MAX_LIFESPAN = MAX_YEARS;

export const SEXES = [
  { id: 'both', label: 'Average', of: 'people' },
  { id: 'male', label: 'Male', of: 'men' },
  { id: 'female', label: 'Female', of: 'women' },
];

export const DEFAULT_LIFESPAN = Object.freeze({ country: '', sex: 'both', custom: null });

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));

export function findCountry(code) {
  return byCode.get(code) ?? null;
}

/** Years, or null for a number the grid can't use. Rounded to a tenth of a year. */
function validYears(value) {
  const n = typeof value === 'string' ? (value.trim() === '' ? NaN : Number(value)) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < MIN_LIFESPAN || n > MAX_LIFESPAN) return null;
  return Math.round(n * 10) / 10;
}

/** Whatever was saved (or restored from a backup), made into a complete, well-formed life span. */
export function cleanLifespan(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { ...DEFAULT_LIFESPAN };
  return {
    country: typeof saved.country === 'string' && byCode.has(saved.country) ? saved.country : '',
    sex: SEXES.some((s) => s.id === saved.sex) ? saved.sex : 'both',
    custom: validYears(saved.custom),
  };
}

/** The country's figure for this sex, in years, or null with no country picked. */
export function expectancy(lifespan) {
  const country = findCountry(lifespan.country);
  return country ? country[lifespan.sex] : null;
}

/** The years the grid counts against, and where they came from: 'custom', 'country' or 'default'. */
export function lifespanYears(lifespan) {
  const custom = validYears(lifespan.custom);
  if (custom !== null) return { years: custom, basis: 'custom' };
  const guide = expectancy(lifespan);
  if (guide !== null) return { years: guide, basis: 'country' };
  return { years: YEARS, basis: 'default' };
}

/** Why `text` can't be someone's own life span, or '' if it can (an empty field is fine: it clears it). */
export function customError(text) {
  if (String(text ?? '').trim() === '') return '';
  return validYears(String(text)) === null
    ? `Enter a number of years from ${MIN_LIFESPAN} to ${MAX_LIFESPAN}.`
    : '';
}

/** `72` or `72.4`: years as a person would say them. */
export function formatYears(years) {
  return Number.isInteger(years) ? String(years) : years.toFixed(1);
}

/** One line on where the grid's length comes from, for Settings. */
export function describeLifespan(lifespan) {
  const { years, basis } = lifespanYears(lifespan);
  const n = `${formatYears(years)} years`;
  if (basis === 'custom') return `Counting your weeks against ${n}, the number you set.`;
  if (basis === 'default') return `Counting your weeks against ${n}. Pick a country to be guided by life expectancy.`;
  const country = findCountry(lifespan.country);
  const of = SEXES.find((s) => s.id === lifespan.sex).of;
  return `Counting your weeks against ${n}: the ${SOURCE.name} estimate of life expectancy at birth for ${of} in ${country.name}, ${country.year}.`;
}
