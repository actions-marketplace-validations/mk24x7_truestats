'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/profile.json');
const { aggregateLanguages, computeStats, isExcluded } = require('../src/data');

test('aggregates bytes across repositories and skips forks', () => {
  const r = aggregateLanguages(fixture.repos, { count: 20 });
  assert.equal(r.repoCount, 4);
  assert.equal(r.privateCount, 2);
  assert.ok(!r.languages.some((l) => l.name === 'C++'), 'fork languages must not be counted');
  assert.equal(r.totalBytes, 600000 + 20000 + 5000 + 300000 + 50000 + 10000 + 250000 + 4000 + 1000 + 800);
  assert.deepEqual(r.languages.slice(0, 3).map((l) => l.name), ['Go', 'TypeScript', 'Swift']);
  const sum = r.languages.reduce((a, l) => a + l.percent, 0);
  assert.ok(Math.abs(sum - 100) < 1e-9);
});

test('limits to the top N and groups the remainder as Other', () => {
  const r = aggregateLanguages(fixture.repos, { count: 3 });
  assert.equal(r.languages.length, 4);
  const other = r.languages[3];
  assert.equal(other.name, 'Other');
  assert.equal(other.size, 50000 + 20000 + 10000 + 5000 + 4000 + 1000 + 800);
  assert.ok(Math.abs(r.languages.reduce((a, l) => a + l.percent, 0) - 100) < 1e-9);
});

test('no Other bucket when everything fits', () => {
  const r = aggregateLanguages(fixture.repos, { count: 50 });
  assert.ok(!r.languages.some((l) => l.other));
});

test('exclude_repos matches by name or owner/name, case-insensitively', () => {
  assert.ok(isExcluded({ name: 'api', nameWithOwner: 'octo-dev/api' }, ['API']));
  assert.ok(isExcluded({ name: 'api', nameWithOwner: 'octo-dev/api' }, ['octo-dev/api']));
  assert.ok(!isExcluded({ name: 'api', nameWithOwner: 'octo-dev/api' }, ['site']));
  const r = aggregateLanguages(fixture.repos, { count: 20, exclude: ['api'] });
  assert.ok(!r.languages.some((l) => l.name === 'Go'));
  assert.equal(r.repoCount, 3);
});

test('empty repository list produces no languages', () => {
  const r = aggregateLanguages([], { count: 8 });
  assert.deepEqual(r.languages, []);
  assert.equal(r.totalBytes, 0);
});

test('computeStats adds private contributions to all-time commits', () => {
  const s = computeStats({ user: fixture.user, repos: fixture.repos, years: fixture.years });
  assert.equal(s.publicCommits, 55);
  assert.equal(s.privateContributions, 1300);
  assert.equal(s.commits, 1355);
  assert.equal(s.pullRequests, 10);
  assert.equal(s.issues, 5);
  assert.equal(s.reviews, 3);
  assert.equal(s.stars, 48);
  assert.equal(s.followers, 1234);
  assert.equal(s.contributedTo, 7);
  assert.equal(s.firstYear, 2024);
  assert.equal(computeStats({ user: fixture.user, repos: fixture.repos, years: fixture.years, exclude: ['site'] }).stars, 6);
});
