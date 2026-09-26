#!/usr/bin/env node
'use strict';

// Local CLI: node src/cli.js --token ... --user mk24x7 --cards stats,languages,streak --pins mk24x7/prune --theme dark --out cards

const { generate } = require('./run');

const USAGE = `Usage: truestats --user <login> [options]

Options:
  --token <token>            GitHub token (default: $GITHUB_TOKEN or $GH_TOKEN)
  --user <login>             GitHub username (required)
  --cards <list>             Comma list of stats,languages,streak,pin (default: stats,languages,streak)
  --pins <list>              Comma list of owner/name repositories to render as pin cards
  --theme <name>             light, dark, tokyonight or transparent (default: dark)
  --colors <spec>            Colour overrides, e.g. bg=0d1117,title=58a6ff
  --out <dir>                Output directory (default: cards)
  --languages-count <n>      Number of languages to show (default: 8)
  --exclude-repos <list>     Comma list of repositories to ignore
  -h, --help                 Show this help
`;

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      opts.help = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument "${arg}".`);
    let key = arg.slice(2);
    let value;
    const eq = key.indexOf('=');
    if (eq !== -1) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
    } else {
      value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for --${key}.`);
      i += 1;
    }
    opts[key] = value;
  }
  return opts;
}

async function cli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help || !args.user) {
    process.stdout.write(USAGE);
    return args.help ? 0 : 2;
  }
  const result = await generate({
    token: args.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
    user: args.user,
    cards: args.cards,
    pins: args.pins,
    theme: args.theme,
    colors: args.colors,
    outDir: args.out,
    languagesCount: args['languages-count'],
    excludeRepos: args['exclude-repos'],
  });
  if (result.stats) console.log(JSON.stringify({ stats: result.stats }, null, 2));
  return 0;
}

if (require.main === module) {
  cli().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(`error: ${err.message}`);
      process.exitCode = 1;
    },
  );
}

module.exports = { cli, parseArgs };
