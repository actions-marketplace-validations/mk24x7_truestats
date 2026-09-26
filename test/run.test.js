'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const fixture = require('./fixtures/profile.json');
const { generate } = require('../src/run');
const { mockFetch } = require('./helpers');

function apiHandler({ privateVisible = true } = {}) {
  return (body) => {
    const q = body.query;
    if (q.includes('repositoriesContributedTo')) return { json: { data: { user: fixture.user } } };
    if (q.includes('repositories(ownerAffiliations')) {
      const nodes = privateVisible ? fixture.repos : fixture.repos.filter((r) => !r.isPrivate);
      return { json: { data: { user: { repositories: { totalCount: nodes.length, nodes, pageInfo: { hasNextPage: false, endCursor: null } } } } } };
    }
    if (q.includes('contributionsCollection')) {
      const user = {};
      for (const y of fixture.years) {
        user[`y${y.year}`] = {
          totalCommitContributions: y.commits,
          totalPullRequestContributions: y.pullRequests,
          totalIssueContributions: y.issues,
          totalPullRequestReviewContributions: y.reviews,
          restrictedContributionsCount: y.restricted,
          contributionCalendar: { totalContributions: y.totalContributions, weeks: [{ contributionDays: y.days }] },
        };
      }
      return { json: { data: { user } } };
    }
    if (q.includes('repository(owner')) return { json: { data: { repository: fixture.pin } } };
    throw new Error(`unexpected query: ${q}`);
  };
}

function quietLog() {
  const warnings = [];
  return { warnings, log: { info: () => {}, warn: (m) => warnings.push(m) } };
}

test('generate writes every requested card', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truestats-'));
  const { fetch } = mockFetch(apiHandler());
  const { log, warnings } = quietLog();
  const result = await generate(
    { token: 't', fetch, user: 'octo-dev', cards: 'stats,languages,streak', pins: 'octo-dev/truestats-demo', outDir, now: new Date('2025-06-06T00:00:00Z') },
    log,
  );
  assert.deepEqual(fs.readdirSync(outDir).sort(), ['languages.svg', 'pin-octo-dev-truestats-demo.svg', 'stats.svg', 'streak.svg']);
  assert.equal(result.stats.commits, 1355);
  assert.equal(result.streak.current.length, 3);
  assert.deepEqual(warnings, []);
});

test('generate warns when the token cannot see private repositories', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truestats-'));
  const { fetch } = mockFetch(apiHandler({ privateVisible: false }));
  const { log, warnings } = quietLog();
  await generate({ token: 't', fetch, user: 'octo-dev', cards: 'languages', outDir }, log);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /cannot see any private repositories/);
  assert.ok(fs.readFileSync(path.join(outDir, 'languages.svg'), 'utf8').includes('(public only)'));
});

test('generate only queries what the requested cards need', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truestats-'));
  const { fetch, calls } = mockFetch(apiHandler());
  await generate({ token: 't', fetch, user: 'octo-dev', cards: 'streak', outDir, now: new Date('2025-06-06T00:00:00Z') }, quietLog().log);
  assert.ok(!calls.some((c) => c.body.query.includes('repositories(ownerAffiliations')));
});

test('generate validates user, cards and pins', async () => {
  const base = { token: 't', fetch: async () => { throw new Error('should not fetch'); }, outDir: os.tmpdir() };
  await assert.rejects(generate({ ...base, user: 'bad user' }, quietLog().log), /Invalid GitHub username/);
  await assert.rejects(generate({ ...base, user: 'octo', cards: 'stats,trophies' }, quietLog().log), /Unknown card "trophies"/);
  await assert.rejects(generate({ ...base, user: 'octo', pins: 'not-a-repo' }, quietLog().log), /Invalid pin/);
});
