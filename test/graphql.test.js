'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const gql = require('../src/graphql');
const { mockFetch, noSleep } = require('./helpers');

const repo = (name, extra = {}) => ({
  name,
  nameWithOwner: `octo/${name}`,
  isPrivate: false,
  isFork: false,
  stargazerCount: 1,
  forkCount: 0,
  languages: { edges: [] },
  ...extra,
});

test('fetchRepositories follows pagination cursors until the last page', async () => {
  const pages = [
    { nodes: [repo('a'), repo('b')], pageInfo: { hasNextPage: true, endCursor: 'c1' } },
    { nodes: [repo('c')], pageInfo: { hasNextPage: true, endCursor: 'c2' } },
    { nodes: [repo('d', { isPrivate: true })], pageInfo: { hasNextPage: false, endCursor: 'c3' } },
  ];
  const { fetch, calls } = mockFetch((body, i) => ({
    json: { data: { user: { repositories: { totalCount: 4, ...pages[i] } } } },
  }));
  const client = gql.createClient({ token: 't', fetch, sleep: noSleep });
  const { repos, totalCount } = await gql.fetchRepositories(client, 'octo');
  assert.equal(totalCount, 4);
  assert.deepEqual(repos.map((r) => r.name), ['a', 'b', 'c', 'd']);
  assert.deepEqual(calls.map((c) => c.body.variables.after), [null, 'c1', 'c2']);
  assert.equal(calls[0].init.headers.authorization, 'bearer t');
});

test('fetchRepositories refuses to loop forever', async () => {
  const { fetch } = mockFetch(() => ({
    json: { data: { user: { repositories: { totalCount: 1, nodes: [repo('x')], pageInfo: { hasNextPage: true, endCursor: 'same' } } } } },
  }));
  const client = gql.createClient({ token: 't', fetch, sleep: noSleep });
  await assert.rejects(gql.fetchRepositories(client, 'octo', { maxPages: 3 }), /Stopped after 3 pages/);
});

test('retries on 5xx and network errors, then succeeds', async () => {
  const sleeps = [];
  const { fetch, calls } = mockFetch((body, i) => {
    if (i === 0) return { status: 502 };
    if (i === 1) return new Error('socket hang up');
    return { json: { data: { ok: true } } };
  });
  const client = gql.createClient({ token: 't', fetch, sleep: async (ms) => sleeps.push(ms), baseDelayMs: 10 });
  assert.deepEqual(await client.request('{ ok }'), { ok: true });
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [10, 20]);
});

test('gives up after the configured retries on persistent 5xx', async () => {
  const { fetch, calls } = mockFetch(() => ({ status: 503 }));
  const client = gql.createClient({ token: 't', fetch, sleep: noSleep, retries: 2 });
  await assert.rejects(client.request('{ ok }'), /HTTP 503 after 3 attempts/);
  assert.equal(calls.length, 3);
});

test('exhausted primary rate limit fails fast with the reset time', async () => {
  const { fetch, calls } = mockFetch(() => ({
    status: 403,
    headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1790000000' },
  }));
  const client = gql.createClient({ token: 't', fetch, sleep: noSleep });
  await assert.rejects(client.request('{ ok }'), (err) => {
    assert.equal(err.rateLimited, true);
    assert.match(err.message, /rate limit exhausted/);
    assert.match(err.message, new RegExp(new Date(1790000000 * 1000).toISOString()));
    return true;
  });
  assert.equal(calls.length, 1);
});

test('secondary rate limit honours retry-after', async () => {
  const sleeps = [];
  const { fetch } = mockFetch((body, i) => (i === 0 ? { status: 403, headers: { 'retry-after': '2' } } : { json: { data: { ok: 1 } } }));
  const client = gql.createClient({ token: 't', fetch, sleep: async (ms) => sleeps.push(ms) });
  assert.deepEqual(await client.request('{ ok }'), { ok: 1 });
  assert.deepEqual(sleeps, [2000]);
});

test('GraphQL RATE_LIMITED errors produce a clear message', async () => {
  const { fetch } = mockFetch(() => ({ json: { errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] } }));
  const client = gql.createClient({ token: 't', fetch, sleep: noSleep });
  await assert.rejects(client.request('{ ok }'), /GraphQL rate limit exceeded/);
});

test('401 explains that the token was rejected', async () => {
  const { fetch } = mockFetch(() => ({ status: 401 }));
  const client = gql.createClient({ token: 'bad', fetch, sleep: noSleep });
  await assert.rejects(client.request('{ ok }'), /rejected the token/);
});

test('missing token is reported before any request', () => {
  assert.throws(() => gql.createClient({ token: '' }), /token is required/);
});

test('fetchRepository maps NOT_FOUND to a readable error', async () => {
  const { fetch } = mockFetch(() => ({
    json: { data: { repository: null }, errors: [{ type: 'NOT_FOUND', message: 'Could not resolve' }] },
  }));
  const client = gql.createClient({ token: 't', fetch, sleep: noSleep });
  await assert.rejects(gql.fetchRepository(client, 'octo', 'missing'), /octo\/missing was not found or the token cannot see it/);
});

test('yearWindows covers every year since account creation, ending now', () => {
  const w = gql.yearWindows('2023-05-01T00:00:00Z', new Date('2025-03-04T05:06:07Z'));
  assert.deepEqual(w.map((x) => x.year), [2023, 2024, 2025]);
  assert.equal(w[0].from, '2023-01-01T00:00:00Z');
  assert.equal(w[1].to, '2024-12-31T23:59:59Z');
  assert.equal(w[2].to, '2025-03-04T05:06:07.000Z');
});

test('fetchContributionYears batches years into aliased queries', async () => {
  const { fetch, calls } = mockFetch((body) => {
    const aliases = [...body.query.matchAll(/y(\d{4}): contributionsCollection/g)].map((m) => m[1]);
    const user = {};
    for (const y of aliases) {
      user[`y${y}`] = {
        totalCommitContributions: 1,
        totalPullRequestContributions: 2,
        totalIssueContributions: 3,
        totalPullRequestReviewContributions: 4,
        restrictedContributionsCount: 10,
        contributionCalendar: { totalContributions: 20, weeks: [{ contributionDays: [{ date: `${y}-06-01`, contributionCount: 1 }] }] },
      };
    }
    return { json: { data: { user } } };
  });
  const client = gql.createClient({ token: 't', fetch, sleep: noSleep });
  const years = await gql.fetchContributionYears(client, 'octo', '2015-02-01T00:00:00Z', new Date('2026-09-26T00:00:00Z'), 4);
  assert.equal(years.length, 12);
  assert.equal(calls.length, 3);
  assert.equal(years[0].year, 2015);
  assert.equal(years[11].restricted, 10);
  assert.deepEqual(years[11].days, [{ date: '2026-06-01', contributionCount: 1 }]);
});
