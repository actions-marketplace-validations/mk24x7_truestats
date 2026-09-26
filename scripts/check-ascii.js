'use strict';

// Fail when any tracked (or, outside git, any) text file contains non-ASCII bytes.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
let files;
try {
  files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
} catch {
  files = [];
}

const bad = [];
for (const rel of files) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
  const buf = fs.readFileSync(file);
  buf.toString('latin1').split('\n').forEach((line, i) => {
    if (/[^\x00-\x7F]/.test(line)) bad.push(`${rel}:${i + 1}`);
  });
}

if (bad.length) {
  console.error(`Non-ASCII characters found:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
console.log(`ASCII check passed for ${files.length} files.`);
