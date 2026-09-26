'use strict';

// GitHub Action entry point. Reads INPUT_* variables directly (no @actions/core).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { generate } = require('./run');

function getInput(name, fallback = '') {
  const value = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function escapeData(s) {
  return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

const log = {
  info: (msg) => console.log(msg),
  warn: (msg) => console.log(`::warning::${escapeData(msg)}`),
  error: (msg) => console.log(`::error::${escapeData(msg)}`),
};

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  fs.appendFileSync(file, `${name}=${String(value).replace(/\n/g, ' ')}\n`);
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function commitCards(outDir, cwd) {
  const rel = path.relative(cwd, outDir) || '.';
  git(['add', '--', rel], cwd);
  const changed = git(['status', '--porcelain', '--', rel], cwd);
  if (!changed) {
    log.info('Cards are unchanged; nothing to commit.');
    return false;
  }
  git(['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit', '-m', 'Update truestats cards [skip ci]', '--', rel], cwd);
  const ref = process.env.GITHUB_REF || '';
  const target = ref.startsWith('refs/heads/') ? ref : null;
  const pushArgs = target ? ['push', 'origin', `HEAD:${target}`] : ['push'];
  try {
    git(pushArgs, cwd);
  } catch (err) {
    // Another push may have landed while we ran; rebase once and retry.
    log.info('Push was rejected; rebasing on the remote branch and retrying once.');
    const branch = target ? target.replace('refs/heads/', '') : git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    git(['pull', '--rebase', 'origin', branch], cwd);
    git(pushArgs, cwd);
  }
  log.info('Committed and pushed updated cards.');
  return true;
}

async function main() {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const token = getInput('token') || process.env.GITHUB_TOKEN || '';
  const outDir = path.resolve(workspace, getInput('output_dir', 'cards'));
  const commit = getInput('commit', 'true').toLowerCase() === 'true';

  const result = await generate(
    {
      token,
      user: getInput('user', process.env.GITHUB_REPOSITORY_OWNER || ''),
      cards: getInput('cards', 'stats,languages,streak'),
      pins: getInput('pins', ''),
      theme: getInput('theme', 'dark'),
      colors: getInput('colors', ''),
      outDir,
      languagesCount: getInput('languages_count', '8'),
      excludeRepos: getInput('exclude_repos', ''),
      excludeArchived: getInput('exclude_archived', 'true'),
    },
    log,
  );

  if (result.stats) {
    const s = result.stats;
    log.info(`Stats: commits ${s.commits} (${s.privateContributions} private), PRs ${s.pullRequests}, issues ${s.issues}, reviews ${s.reviews}, stars ${s.stars}, followers ${s.followers}, contributed to ${s.contributedTo}.`);
  }
  setOutput('files', result.files.map((f) => path.relative(workspace, f)).join(','));

  let committed = false;
  if (commit) committed = commitCards(outDir, workspace);
  else log.info('commit is false; leaving the generated cards in the workspace.');
  setOutput('committed', committed);
}

main().catch((err) => {
  log.error(err && err.message ? err.message : String(err));
  process.exitCode = 1;
});
