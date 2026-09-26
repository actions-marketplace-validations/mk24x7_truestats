'use strict';

const { WIDTH, PAD, escapeXml, formatNumber, languageColor, renderCard } = require('./common');

// Roughly 62 characters of 13px system sans fit in the 432px text column.
const CHARS_PER_LINE = 62;
const MAX_LINES = 3;

function wrapText(text, width = CHARS_PER_LINE, maxLines = MAX_LINES) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if ([...candidate].length <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = [...word].length > width ? `${[...word].slice(0, width - 3).join('')}...` : word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1];
    kept[maxLines - 1] = [...last].length > width - 3 ? `${[...last].slice(0, width - 3).join('')}...` : `${last}...`;
    return kept;
  }
  return lines;
}

function slugFor(nameWithOwner) {
  return String(nameWithOwner).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
}

function renderPin(repo, theme) {
  const parts = [];
  const lines = wrapText(repo.description || 'No description provided.');
  const tags = [];
  if (repo.isPrivate) tags.push('Private');
  if (repo.isArchived) tags.push('Archived');
  if (repo.isFork) tags.push('Fork');
  if (tags.length) {
    parts.push(`  <text x="${WIDTH - PAD}" y="36" class="small" text-anchor="end">${escapeXml(tags.join(' / '))}</text>`);
  }
  lines.forEach((line, i) => {
    parts.push(`  <text x="${PAD}" y="${64 + i * 20}" class="body">${escapeXml(line)}</text>`);
  });
  const metaY = 64 + (lines.length - 1) * 20 + 34;
  let x = PAD;
  const lang = repo.primaryLanguage;
  if (lang && lang.name) {
    parts.push(`  <circle cx="${x + 5}" cy="${metaY - 4}" r="5" fill="${languageColor(lang.name, lang.color)}"/>`);
    parts.push(`  <text x="${x + 16}" y="${metaY}" class="label">${escapeXml(lang.name)}</text>`);
    x += 16 + [...lang.name].length * 7.5 + 20;
  }
  const stars = `${formatNumber(repo.stargazerCount)} ${repo.stargazerCount === 1 ? 'star' : 'stars'}`;
  const forks = `${formatNumber(repo.forkCount)} ${repo.forkCount === 1 ? 'fork' : 'forks'}`;
  parts.push(`  <text x="${x}" y="${metaY}" class="label">${escapeXml(stars)}</text>`);
  x += stars.length * 7.5 + 20;
  parts.push(`  <text x="${x}" y="${metaY}" class="label">${escapeXml(forks)}</text>`);
  const height = metaY + 24;
  const desc = `${repo.nameWithOwner}: ${repo.description || 'No description'}. ${lang && lang.name ? `${lang.name}. ` : ''}${stars}, ${forks}.`;
  return renderCard({ id: `truestats-pin-${slugFor(repo.nameWithOwner)}`, height, title: repo.name, desc, body: parts.join('\n'), theme });
}

module.exports = { renderPin, wrapText, slugFor };
