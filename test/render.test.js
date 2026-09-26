'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const fixture = require('./fixtures/profile.json');
const data = require('../src/data');
const { resolveTheme, parseColors, THEMES } = require('../src/svg/theme');
const { escapeXml } = require('../src/svg/common');
const { renderStats } = require('../src/svg/stats');
const { renderLanguages } = require('../src/svg/languages');
const { renderStreak } = require('../src/svg/streak');
const { renderPin, wrapText } = require('../src/svg/pin');

const SNAP_DIR = path.join(__dirname, 'snapshots');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

function matchSnapshot(name, svg) {
  const file = path.join(SNAP_DIR, `${name}.svg`);
  if (UPDATE || !fs.existsSync(file)) {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    fs.writeFileSync(file, svg);
    if (!UPDATE) assert.fail(`Snapshot ${name}.svg was missing and has been written; re-run the tests.`);
    return;
  }
  assert.equal(svg, fs.readFileSync(file, 'utf8'), `Snapshot ${name}.svg differs; run UPDATE_SNAPSHOTS=1 npm test if intended.`);
}

function assertWellFormed(svg) {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="480" height="\d+" viewBox="0 0 480 \d+"/);
  assert.match(svg, /<title id="[^"]+">[^<]+<\/title>/);
  assert.ok(!/[^\x00-\x7F]/.test(svg), 'SVG output must be pure ASCII');
  assert.ok(!/@import|url\(http|<image|<script/i.test(svg), 'no external resources or scripts');
  const open = (svg.match(/<(g|text|svg|defs|clipPath|style|title|desc)\b/g) || []).length;
  const close = (svg.match(/<\/(g|text|svg|defs|clipPath|style|title|desc)>/g) || []).length;
  assert.equal(open, close, 'balanced container tags');
  const [, h] = svg.match(/height="(\d+)"/);
  const ys = [...svg.matchAll(/<text [^>]*y="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...ys) < Number(h), 'all text sits inside the card');
}

const dark = resolveTheme('dark');
const stats = data.computeStats({ user: fixture.user, repos: fixture.repos, years: fixture.years });
const langs = data.aggregateLanguages(fixture.repos, { count: 5 });
const streak = data.computeStreakCard(fixture.years, new Date('2025-06-06T10:00:00Z'));

test('stats card renders every number as text', () => {
  const svg = renderStats(stats, dark);
  assertWellFormed(svg);
  for (const n of ['1,355', '10', '48', '1,234', '7']) assert.ok(svg.includes(`>${n}</text>`), `missing ${n}`);
  assert.ok(svg.includes('Commits include 1,300 private contributions.'));
  assert.ok(svg.includes('Octo Dev&#39;s GitHub stats'));
  matchSnapshot('stats-dark', svg);
});

test('languages card renders a stacked bar and legend', () => {
  const svg = renderLanguages(langs, dark);
  assertWellFormed(svg);
  assert.equal((svg.match(/<circle /g) || []).length, langs.languages.length);
  assert.ok(svg.includes('>Go</text>'));
  assert.ok(svg.includes('>Other</text>'));
  assert.ok(svg.includes('fill="#00ADD8"'), 'uses the embedded GitHub colour for Go');
  assert.ok(svg.includes('4 repositories (2 private)'));
  matchSnapshot('languages-dark', svg);
});

test('languages card falls back to the API colour for unmapped languages', () => {
  const svg = renderLanguages(data.aggregateLanguages(fixture.repos, { count: 20 }), dark);
  assert.ok(svg.includes('fill="#67b8de"'), 'Liquid colour comes from the API');
});

test('languages card handles no data', () => {
  const svg = renderLanguages({ languages: [], totalBytes: 0, repoCount: 0, privateCount: 0 }, dark);
  assertWellFormed(svg);
  assert.ok(svg.includes('No language data visible to this token.'));
});

test('streak card renders totals and date ranges', () => {
  assert.equal(streak.current.length, 3);
  assert.equal(streak.longest.length, 5);
  const svg = renderStreak(streak, dark);
  assertWellFormed(svg);
  assert.ok(svg.includes('Contributions in 2025'));
  assert.ok(svg.includes('Jun 3 - Jun 5, 2025'));
  assert.ok(svg.includes('Dec 29, 2024 - Jan 2, 2025'), 'longest streak spans the year boundary');
  matchSnapshot('streak-dark', svg);
});

test('streak card with no activity', () => {
  const svg = renderStreak(data.computeStreakCard([], new Date('2026-01-10T00:00:00Z')), dark);
  assertWellFormed(svg);
  assert.ok(svg.includes('No active streak'));
});

test('pin card wraps and escapes the description', () => {
  const svg = renderPin(fixture.pin, dark);
  assertWellFormed(svg);
  assert.ok(svg.includes('&amp; escape &lt;markup&gt;.'));
  assert.ok(svg.includes('>1 star</text>'));
  assert.ok(svg.includes('>12 forks</text>'));
  assert.ok((svg.match(/class="body"/g) || []).length >= 2, 'description wraps');
  matchSnapshot('pin-light', renderPin(fixture.pin, resolveTheme('light')));
});

test('non-ASCII text is kept as numeric character references', () => {
  assert.equal(escapeXml('caf\u00e9 \u{1F680}'), 'caf&#xE9; &#x1F680;');
  const svg = renderPin({ ...fixture.pin, description: 'Rocket \u{1F680} launcher' }, dark);
  assert.ok(svg.includes('Rocket &#x1F680; launcher'));
  assertWellFormed(svg);
});

test('wrapText truncates to three lines with an ellipsis', () => {
  const lines = wrapText('word '.repeat(100), 20, 3);
  assert.equal(lines.length, 3);
  assert.ok(lines[2].endsWith('...'));
  assert.ok(lines.every((l) => l.length <= 20));
});

test('every theme renders and transparent has no background fill', () => {
  for (const name of Object.keys(THEMES)) assertWellFormed(renderStats(stats, resolveTheme(name)));
  assert.ok(renderStats(stats, resolveTheme('transparent')).includes('fill="none"'));
  matchSnapshot('stats-tokyonight', renderStats(stats, resolveTheme('tokyonight')));
});

test('explicit colours override the theme and bad values are rejected', () => {
  const warnings = [];
  const overrides = parseColors('bg=ffffff, title=#FF0000, text=red, bogus=123456, border="/><script>', (w) => warnings.push(w));
  assert.deepEqual(overrides, { bg: '#ffffff', title: '#ff0000' });
  assert.equal(warnings.length, 3);
  const svg = renderStats(stats, resolveTheme('dark', overrides));
  assert.ok(svg.includes('fill: #ff0000;'));
  assert.ok(svg.includes('fill="#ffffff"'));
});

test('unknown theme falls back to dark with a warning', () => {
  const warnings = [];
  assert.deepEqual(resolveTheme('neon', {}, (w) => warnings.push(w)), THEMES.dark);
  assert.equal(warnings.length, 1);
});
