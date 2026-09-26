'use strict';

// Minimal GitHub GraphQL client with retries plus the queries truestats needs.
// Zero dependencies: uses the global fetch available in Node 18+.

const ENDPOINT = 'https://api.github.com/graphql';

class GitHubError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'GitHubError';
    Object.assign(this, details);
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function formatReset(header) {
  const epoch = Number(header);
  if (!Number.isFinite(epoch) || epoch <= 0) return 'later';
  return new Date(epoch * 1000).toISOString();
}

/**
 * Create a GraphQL client.
 * options: { token, fetch, sleep, retries, baseDelayMs, maxWaitMs, endpoint }
 */
function createClient(options = {}) {
  const {
    token,
    fetch: fetchImpl = globalThis.fetch,
    sleep = defaultSleep,
    retries = 3,
    baseDelayMs = 1000,
    maxWaitMs = 60000,
    endpoint = ENDPOINT,
  } = options;
  if (!token) throw new GitHubError('A GitHub token is required (input "token" or --token).');
  if (typeof fetchImpl !== 'function') throw new GitHubError('No fetch implementation available; use Node 18 or newer.');

  async function request(query, variables = {}) {
    let attempt = 0;
    for (;;) {
      let res;
      try {
        res = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            authorization: `bearer ${token}`,
            'content-type': 'application/json',
            'user-agent': 'truestats',
          },
          body: JSON.stringify({ query, variables }),
        });
      } catch (err) {
        if (attempt < retries) {
          await sleep(baseDelayMs * 2 ** attempt);
          attempt += 1;
          continue;
        }
        throw new GitHubError(`Network error talking to the GitHub API: ${err.message}`, { cause: err });
      }

      const header = (name) => (res.headers && typeof res.headers.get === 'function' ? res.headers.get(name) : null);

      if (res.status === 401) {
        throw new GitHubError('GitHub rejected the token (HTTP 401 Bad credentials). Check the "token" input or secret.', { status: 401 });
      }

      if (res.status === 403 || res.status === 429) {
        const remaining = header('x-ratelimit-remaining');
        const retryAfter = Number(header('retry-after'));
        if (remaining === '0') {
          throw new GitHubError(
            `GitHub API rate limit exhausted (HTTP ${res.status}). It resets at ${formatReset(header('x-ratelimit-reset'))}. ` +
              'Run less often or use a token with its own quota.',
            { status: res.status, rateLimited: true },
          );
        }
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * 2 ** attempt;
        if (attempt < retries && waitMs <= maxWaitMs) {
          await sleep(waitMs);
          attempt += 1;
          continue;
        }
        const text = await safeText(res);
        throw new GitHubError(
          `GitHub API refused the request (HTTP ${res.status}); this is usually a secondary rate limit or missing token permission. ${text}`.trim(),
          { status: res.status, rateLimited: res.status === 429 },
        );
      }

      if (res.status >= 500) {
        if (attempt < retries) {
          await sleep(baseDelayMs * 2 ** attempt);
          attempt += 1;
          continue;
        }
        throw new GitHubError(`GitHub API returned HTTP ${res.status} after ${retries + 1} attempts.`, { status: res.status });
      }

      if (!res.ok) {
        const text = await safeText(res);
        throw new GitHubError(`GitHub API returned HTTP ${res.status}: ${text}`.trim(), { status: res.status });
      }

      const body = await res.json();
      if (Array.isArray(body.errors) && body.errors.length > 0) {
        if (body.errors.some((e) => e.type === 'RATE_LIMITED')) {
          throw new GitHubError('GitHub GraphQL rate limit exceeded. Wait for the hourly quota to reset and try again.', {
            rateLimited: true,
            errors: body.errors,
          });
        }
        const message = body.errors.map((e) => e.message).join('; ');
        throw new GitHubError(`GitHub GraphQL error: ${message}`, { errors: body.errors, data: body.data });
      }
      return body.data;
    }
  }

  return { request };
}

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '';
  }
}

const USER_QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    name
    createdAt
    followers { totalCount }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
  }
}`;

const REPOS_QUERY = `
query($login: String!, $after: String) {
  user(login: $login) {
    repositories(ownerAffiliations: OWNER, first: 100, after: $after, orderBy: {field: CREATED_AT, direction: ASC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        nameWithOwner
        isPrivate
        isFork
        isArchived
        stargazerCount
        forkCount
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

const PIN_QUERY = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    name
    nameWithOwner
    description
    isPrivate
    isFork
    isArchived
    stargazerCount
    forkCount
    primaryLanguage { name color }
  }
}`;

async function fetchUser(client, login) {
  const data = await client.request(USER_QUERY, { login });
  if (!data || !data.user) throw new GitHubError(`GitHub user "${login}" was not found.`);
  return data.user;
}

async function fetchRepositories(client, login, { maxPages = 50 } = {}) {
  const repos = [];
  let after = null;
  let totalCount = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const data = await client.request(REPOS_QUERY, { login, after });
    if (!data || !data.user) throw new GitHubError(`GitHub user "${login}" was not found.`);
    const conn = data.user.repositories;
    totalCount = conn.totalCount;
    repos.push(...conn.nodes.filter(Boolean));
    if (!conn.pageInfo.hasNextPage) return { repos, totalCount };
    after = conn.pageInfo.endCursor;
  }
  throw new GitHubError(`Stopped after ${maxPages} pages of repositories; refusing to loop further.`);
}

function yearWindows(createdAt, now) {
  const start = new Date(createdAt).getUTCFullYear();
  const end = now.getUTCFullYear();
  const windows = [];
  for (let y = start; y <= end; y += 1) {
    const from = `${y}-01-01T00:00:00Z`;
    const to = y === end ? now.toISOString() : `${y}-12-31T23:59:59Z`;
    windows.push({ year: y, from, to });
  }
  return windows;
}

function yearsQuery(windows) {
  const parts = windows.map(
    (w) => `
    y${w.year}: contributionsCollection(from: "${w.from}", to: "${w.to}") {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }`,
  );
  return `query($login: String!) { user(login: $login) {${parts.join('')}\n  } }`;
}

/**
 * Fetch contribution totals and calendars for every calendar year since the
 * account was created. Years are batched to keep each query small.
 */
async function fetchContributionYears(client, login, createdAt, now = new Date(), batchSize = 4) {
  const windows = yearWindows(createdAt, now);
  const years = [];
  for (let i = 0; i < windows.length; i += batchSize) {
    const batch = windows.slice(i, i + batchSize);
    const data = await client.request(yearsQuery(batch), { login });
    if (!data || !data.user) throw new GitHubError(`GitHub user "${login}" was not found.`);
    for (const w of batch) {
      const c = data.user[`y${w.year}`];
      if (!c) continue;
      years.push({
        year: w.year,
        commits: c.totalCommitContributions,
        pullRequests: c.totalPullRequestContributions,
        issues: c.totalIssueContributions,
        reviews: c.totalPullRequestReviewContributions,
        restricted: c.restrictedContributionsCount,
        totalContributions: c.contributionCalendar.totalContributions,
        days: c.contributionCalendar.weeks.flatMap((wk) => wk.contributionDays),
      });
    }
  }
  return years;
}

async function fetchRepository(client, owner, name) {
  let data;
  try {
    data = await client.request(PIN_QUERY, { owner, name });
  } catch (err) {
    if (err.errors && err.errors.some((e) => e.type === 'NOT_FOUND')) {
      throw new GitHubError(`Repository ${owner}/${name} was not found or the token cannot see it.`);
    }
    throw err;
  }
  if (!data || !data.repository) throw new GitHubError(`Repository ${owner}/${name} was not found or the token cannot see it.`);
  return data.repository;
}

module.exports = {
  GitHubError,
  createClient,
  fetchUser,
  fetchRepositories,
  fetchContributionYears,
  fetchRepository,
  yearWindows,
  yearsQuery,
};
