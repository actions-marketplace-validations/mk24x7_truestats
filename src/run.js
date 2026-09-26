'use strict';

const fs = require('fs');
const path = require('path');
const gql = require('./graphql');
const data = require('./data');
const { parseColors, resolveTheme } = require('./svg/theme');
const { renderStats } = require('./svg/stats');
const { renderLanguages } = require('./svg/languages');
const { renderStreak } = require('./svg/streak');
const { renderPin, slugFor } = require('./svg/pin');

const KNOWN_CARDS = ['stats', 'languages', 'streak', 'pin'];
const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/;

function splitList(value) {
  return String(value || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const consoleLog = {
  info: (msg) => console.log(msg),
  warn: (msg) => console.warn(`warning: ${msg}`),
};

/**
 * Fetch everything needed for the requested cards, render them, and write SVG files.
 * Returns { files, stats, languages, streak, pins }.
 */
async function generate(options, log = consoleLog) {
  const user = String(options.user || '').trim();
  if (!LOGIN_RE.test(user)) throw new Error(`Invalid GitHub username "${user}".`);

  const cards = splitList(options.cards || 'stats,languages,streak').map((c) => c.toLowerCase());
  for (const c of cards) {
    if (!KNOWN_CARDS.includes(c)) throw new Error(`Unknown card "${c}". Valid cards: ${KNOWN_CARDS.join(', ')}.`);
  }
  const pins = splitList(options.pins).map((p) => {
    const m = REPO_RE.exec(p);
    if (!m) throw new Error(`Invalid pin "${p}": expected owner/name.`);
    return { owner: m[1], name: m[2] };
  });
  if (cards.includes('pin') && pins.length === 0) log.warn('Card "pin" was requested but "pins" is empty; no pin cards will be rendered.');

  const exclude = splitList(options.excludeRepos);
  const excludeArchived = String(options.excludeArchived == null ? 'true' : options.excludeArchived).trim().toLowerCase() !== 'false';
  const languagesCount = Math.min(20, Math.max(1, parseInt(options.languagesCount, 10) || 8));
  const theme = resolveTheme(options.theme, parseColors(options.colors, log.warn), log.warn);
  const outDir = path.resolve(options.outDir || 'cards');
  const now = options.now || new Date();

  const client = options.client || gql.createClient({ token: options.token, fetch: options.fetch });
  const needRepos = cards.includes('stats') || cards.includes('languages');
  const needYears = cards.includes('stats') || cards.includes('streak');

  log.info(`Fetching GitHub data for ${user}...`);
  const profile = await gql.fetchUser(client, user);

  let repos = [];
  if (needRepos) {
    const result = await gql.fetchRepositories(client, user);
    repos = result.repos;
    const privateRepos = repos.filter((r) => r.isPrivate).length;
    log.info(`Repositories visible to the token: ${repos.length} (${privateRepos} private).`);
    if (privateRepos === 0) {
      log.warn(
        `The token cannot see any private repositories owned by ${user}, so stars and languages cover public repositories only. ` +
          'Use a fine-grained personal access token with read access to your private repositories to include them.',
      );
    }
  }

  let years = [];
  if (needYears) {
    years = await gql.fetchContributionYears(client, user, profile.createdAt, now);
    const restricted = years.reduce((a, y) => a + y.restricted, 0);
    log.info(`Contribution history: ${years.length} years, ${restricted} private contributions reported by GitHub.`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const files = [];
  const write = (name, svg) => {
    const file = path.join(outDir, name);
    fs.writeFileSync(file, svg);
    files.push(file);
    log.info(`Wrote ${path.relative(process.cwd(), file) || file}`);
  };

  const result = { files };
  if (cards.includes('stats')) {
    result.stats = data.computeStats({ user: profile, repos, years, exclude, excludeArchived });
    write('stats.svg', renderStats(result.stats, theme));
  }
  if (cards.includes('languages')) {
    result.languages = data.aggregateLanguages(repos, { count: languagesCount, exclude, excludeArchived });
    write('languages.svg', renderLanguages(result.languages, theme));
  }
  if (cards.includes('streak')) {
    result.streak = data.computeStreakCard(years, now);
    write('streak.svg', renderStreak(result.streak, theme));
  }
  result.pins = [];
  for (const pin of pins) {
    const repo = await gql.fetchRepository(client, pin.owner, pin.name);
    result.pins.push(repo);
    write(`pin-${slugFor(repo.nameWithOwner)}.svg`, renderPin(repo, theme));
  }
  return result;
}

module.exports = { generate, splitList, KNOWN_CARDS };
