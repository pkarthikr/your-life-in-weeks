import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COUNTRIES,
  SOURCE,
  SEXES,
  DEFAULT_LIFESPAN,
  findCountry,
  cleanLifespan,
  lifespanYears,
  expectancy,
  customError,
  formatYears,
  describeLifespan,
} from '../site/js/lifespan.js';
import { YEARS, MAX_YEARS } from '../site/js/weeks.js';

test('the data covers the world: unique codes, names and plausible figures', () => {
  assert.ok(COUNTRIES.length > 150);
  assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, COUNTRIES.length);
  assert.deepEqual(COUNTRIES.map((c) => c.name), [...COUNTRIES.map((c) => c.name)].sort((a, z) => a.localeCompare(z, 'en')));
  for (const c of COUNTRIES) {
    for (const sex of ['both', 'male', 'female']) {
      assert.ok(c[sex] > 40 && c[sex] < 100, `${c.name} ${sex}: ${c[sex]}`);
    }
    assert.ok(c.year >= 2000 && c.year <= 2100, c.name);
    assert.ok(c.both >= Math.min(c.male, c.female) - 0.1 && c.both <= Math.max(c.male, c.female) + 0.1, `${c.name}: the average sits between the sexes`);
  }
  assert.match(SOURCE.url, /^https:\/\/www\.who\.int\//);
});

test('a country and sex give that country’s figure', () => {
  const india = findCountry('IND');
  assert.equal(india.name, 'India');
  assert.equal(expectancy({ country: 'IND', sex: 'male' }), india.male);
  assert.equal(expectancy({ country: 'IND', sex: 'female' }), india.female);
  assert.equal(expectancy({ country: 'IND', sex: 'both' }), india.both);
  assert.equal(expectancy({ country: '', sex: 'male' }), null);
  assert.equal(findCountry('ZZZ'), null);
});

test('a number of your own wins, then the country’s figure, then 100', () => {
  const india = findCountry('IND');
  assert.deepEqual(lifespanYears({ country: 'IND', sex: 'male', custom: 120 }), { years: 120, basis: 'custom' });
  assert.deepEqual(lifespanYears({ country: 'IND', sex: 'male', custom: null }), { years: india.male, basis: 'country' });
  assert.deepEqual(lifespanYears(DEFAULT_LIFESPAN), { years: YEARS, basis: 'default' });
  assert.deepEqual(lifespanYears({ country: '', sex: 'both', custom: 72.44 }), { years: 72.4, basis: 'custom' });
});

test('cleanLifespan keeps good values and drops the rest', () => {
  assert.deepEqual(cleanLifespan({ country: 'JPN', sex: 'female', custom: '88.25' }), { country: 'JPN', sex: 'female', custom: 88.3 });
  assert.deepEqual(cleanLifespan({ country: 'JPN', sex: 'x', custom: MAX_YEARS + 1 }), { country: 'JPN', sex: 'both', custom: null });
  assert.deepEqual(cleanLifespan({ custom: MAX_YEARS }).custom, MAX_YEARS);
  assert.deepEqual(cleanLifespan({ custom: '' }).custom, null);
  assert.deepEqual(cleanLifespan(null), DEFAULT_LIFESPAN);
  assert.ok(SEXES.every((s) => cleanLifespan({ sex: s.id }).sex === s.id));
});

test('customError accepts a blank (clearing it) or a usable number', () => {
  for (const ok of ['', '  ', '1', '72', '72.5', '120', '150']) assert.equal(customError(ok), '', ok);
  for (const bad of ['abc', '0', '-5', '151', '1e3', 'NaN', '12 years']) {
    assert.match(customError(bad), /from 1 to 150/, bad);
  }
});

test('years read as a person would say them', () => {
  assert.equal(formatYears(100), '100');
  assert.equal(formatYears(72.4), '72.4');
});

test('describeLifespan says where the number comes from', () => {
  assert.match(describeLifespan(DEFAULT_LIFESPAN), /100 years\. Pick a country/);
  assert.match(describeLifespan({ country: '', sex: 'both', custom: 120 }), /120 years, the number you set/);
  const text = describeLifespan({ country: 'IND', sex: 'male', custom: null });
  assert.match(text, /men in India, 2023/);
  assert.ok(text.includes(`${findCountry('IND').male} years`));
});
