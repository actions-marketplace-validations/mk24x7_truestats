'use strict';

// Pure aggregation helpers: no network, no filesystem. Everything here is unit tested.

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(key) {
  return new Date(`${key}T00:00:00Z`);
}

function addDays(key, delta) {
  return toDateKey(new Date(parseDateKey(key).getTime() + delta * DAY_MS));
}

/**
 * Merge contribution days from several calendars into one sorted, de-duplicated list.
 * When a date appears twice (overlapping windows) the larger count wins.
 */
function mergeDays(dayLists) {
  const byDate = new Map();
  for (const list of dayLists) {
    for (const d of list || []) {
      const prev = byDate.get(d.date) || 0;
      byDate.set(d.date, Math.max(prev, d.contributionCount || 0));
    }
  }
  return [...byDate.keys()].sort().map((date) => ({ date, contributionCount: byDate.get(date) }));
}

/**
 * Compute streaks from contribution days.
 * A streak is a run of consecutive calendar days with at least one contribution.
 * The current streak is not broken by today having no contributions yet: if today
 * is empty, counting starts from yesterday.
 * Dates missing from the input count as zero-contribution days.
 */
function computeStreaks(days, today) {
  const empty = {
    current: { length: 0, start: null, end: null },
    longest: { length: 0, start: null, end: null },
  };
  const merged = mergeDays([days]);
  if (merged.length === 0) return empty;

  const counts = new Map(merged.map((d) => [d.date, d.contributionCount]));
  const todayKey = today || merged[merged.length - 1].date;

  // Longest streak: walk every date from the first to the last known day.
  let longest = { length: 0, start: null, end: null };
  let runStart = null;
  let runLength = 0;
  const lastKey = merged[merged.length - 1].date > todayKey ? merged[merged.length - 1].date : todayKey;
  for (let key = merged[0].date; key <= lastKey; key = addDays(key, 1)) {
    if ((counts.get(key) || 0) > 0) {
      if (runLength === 0) runStart = key;
      runLength += 1;
      if (runLength > longest.length) longest = { length: runLength, start: runStart, end: key };
    } else {
      runLength = 0;
    }
  }

  // Current streak: anchor on today, or yesterday when today has nothing yet.
  let anchor = todayKey;
  if ((counts.get(anchor) || 0) === 0) anchor = addDays(todayKey, -1);
  let current = { length: 0, start: null, end: null };
  if ((counts.get(anchor) || 0) > 0) {
    let start = anchor;
    let length = 0;
    for (let key = anchor; (counts.get(key) || 0) > 0; key = addDays(key, -1)) {
      start = key;
      length += 1;
    }
    current = { length, start, end: anchor };
  }

  return { current, longest };
}

/** Sum contributions for a given calendar year (e.g. "this year"). */
function contributionsInYear(days, year) {
  const prefix = `${year}-`;
  return mergeDays([days])
    .filter((d) => d.date.startsWith(prefix))
    .reduce((sum, d) => sum + d.contributionCount, 0);
}

function normalizeRepoName(name) {
  return String(name || '').trim().toLowerCase();
}

/** Returns true when a repo should be excluded; matches "name" or "owner/name". */
function isExcluded(repo, excludeList) {
  if (!excludeList || excludeList.length === 0) return false;
  const set = new Set(excludeList.map(normalizeRepoName));
  return set.has(normalizeRepoName(repo.name)) || set.has(normalizeRepoName(repo.nameWithOwner));
}

/**
 * Aggregate language byte counts across repositories.
 * Forks are skipped (their code is mostly someone else's) and so are excluded repos.
 * Returns the top `count` languages plus an "Other" bucket for the remainder.
 */
function aggregateLanguages(repos, { count = 8, exclude = [], includeForks = false, excludeArchived = true } = {}) {
  const totals = new Map();
  const colors = new Map();
  let repoCount = 0;
  let privateCount = 0;
  for (const repo of repos) {
    if (!includeForks && repo.isFork) continue;
    if (excludeArchived && repo.isArchived) continue;
    if (isExcluded(repo, exclude)) continue;
    repoCount += 1;
    if (repo.isPrivate) privateCount += 1;
    const edges = (repo.languages && repo.languages.edges) || [];
    for (const edge of edges) {
      const name = edge.node.name;
      totals.set(name, (totals.get(name) || 0) + edge.size);
      if (edge.node.color && !colors.has(name)) colors.set(name, edge.node.color);
    }
  }
  const totalBytes = [...totals.values()].reduce((a, b) => a + b, 0);
  const sorted = [...totals.entries()]
    .map(([name, size]) => ({ name, size, color: colors.get(name) || null }))
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
  const n = Math.max(1, Number(count) || 8);
  const top = sorted.slice(0, n);
  const otherSize = sorted.slice(n).reduce((a, l) => a + l.size, 0);
  const withPercent = top.map((l) => ({ ...l, percent: totalBytes ? (l.size / totalBytes) * 100 : 0 }));
  if (otherSize > 0) {
    withPercent.push({ name: 'Other', size: otherSize, color: null, percent: (otherSize / totalBytes) * 100, other: true });
  }
  return { languages: withPercent, totalBytes, repoCount, privateCount, excludeArchived: Boolean(excludeArchived) };
}

/**
 * Combine the raw API results into the numbers shown on the stats card.
 * Commits include private (restricted) contributions and cover every year since
 * the account was created.
 */
function computeStats({ user, repos, years, exclude = [], excludeArchived = true }) {
  const sum = (key) => years.reduce((acc, y) => acc + (y[key] || 0), 0);
  const visibleRepos = repos.filter((r) => !isExcluded(r, exclude) && !(excludeArchived && r.isArchived));
  const publicCommits = sum('commits');
  const privateContributions = sum('restricted');
  return {
    login: user.login,
    name: user.name || user.login,
    commits: publicCommits + privateContributions,
    publicCommits,
    privateContributions,
    pullRequests: sum('pullRequests'),
    issues: sum('issues'),
    reviews: sum('reviews'),
    stars: visibleRepos.reduce((acc, r) => acc + (r.stargazerCount || 0), 0),
    followers: user.followers ? user.followers.totalCount : 0,
    contributedTo: user.repositoriesContributedTo ? user.repositoriesContributedTo.totalCount : 0,
    firstYear: years.length ? years[0].year : null,
    repoCount: visibleRepos.length,
    privateRepoCount: visibleRepos.filter((r) => r.isPrivate).length,
  };
}

/** Build the streak card model from yearly calendars. */
function computeStreakCard(years, now = new Date()) {
  const days = mergeDays(years.map((y) => y.days));
  const todayKey = toDateKey(now);
  const year = now.getUTCFullYear();
  const streaks = computeStreaks(days, todayKey);
  return { ...streaks, year, today: todayKey, totalThisYear: contributionsInYear(days, year) };
}

module.exports = {
  addDays,
  toDateKey,
  mergeDays,
  computeStreaks,
  contributionsInYear,
  isExcluded,
  aggregateLanguages,
  computeStats,
  computeStreakCard,
};
