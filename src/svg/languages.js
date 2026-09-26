'use strict';

const { WIDTH, PAD, escapeXml, formatNumber, formatPercent, languageColor, renderCard } = require('./common');

const BAR_Y = 54;
const BAR_H = 10;
const LEGEND_START = 92;
const LEGEND_GAP = 24;

function renderLanguages(model, theme) {
  const { languages, repoCount, privateCount } = model;
  const barWidth = WIDTH - PAD * 2;
  const parts = [];

  parts.push('  <defs>');
  parts.push(`    <clipPath id="truestats-lang-bar"><rect x="${PAD}" y="${BAR_Y}" width="${barWidth}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath>`);
  parts.push('  </defs>');
  parts.push(`  <rect x="${PAD}" y="${BAR_Y}" width="${barWidth}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${theme.track}"/>`);

  if (languages.length === 0) {
    parts.push(`  <text x="${PAD}" y="${LEGEND_START}" class="label">No language data visible to this token.</text>`);
  } else {
    const total = languages.reduce((a, l) => a + l.percent, 0) || 1;
    parts.push('  <g clip-path="url(#truestats-lang-bar)">');
    let x = PAD;
    languages.forEach((lang, i) => {
      // Segments share the whole bar; the last one absorbs rounding error.
      const w = i === languages.length - 1 ? PAD + barWidth - x : (lang.percent / total) * barWidth;
      parts.push(`    <rect x="${x.toFixed(2)}" y="${BAR_Y}" width="${Math.max(0, w).toFixed(2)}" height="${BAR_H}" fill="${languageColor(lang.name, lang.color)}"/>`);
      x += w;
    });
    parts.push('  </g>');

    const colWidth = barWidth / 2;
    languages.forEach((lang, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = PAD + col * colWidth;
      const y = LEGEND_START + row * LEGEND_GAP;
      parts.push('  <g>');
      parts.push(`    <circle cx="${cx + 5}" cy="${y - 4}" r="5" fill="${languageColor(lang.name, lang.color)}"/>`);
      parts.push(`    <text x="${cx + 16}" y="${y}" class="body">${escapeXml(lang.name)}</text>`);
      parts.push(`    <text x="${cx + colWidth - 12}" y="${y}" class="label" text-anchor="end">${formatPercent(lang.percent)}</text>`);
      parts.push('  </g>');
    });
  }

  const rows = Math.max(1, Math.ceil(languages.length / 2));
  const footerY = LEGEND_START + (rows - 1) * LEGEND_GAP + 32;
  const privateNote = privateCount > 0 ? ` (${formatNumber(privateCount)} private)` : ' (public only)';
  parts.push(`  <text x="${PAD}" y="${footerY}" class="small">${escapeXml(`By bytes across ${formatNumber(repoCount)} repositories${privateNote}. ${model.excludeArchived ? 'Archived and forks excluded.' : 'Forks excluded.'}`)}</text>`);
  const height = footerY + 22;
  const desc = languages.length
    ? languages.map((l) => `${l.name} ${formatPercent(l.percent)}`).join(', ')
    : 'No language data';
  return renderCard({ id: 'truestats-languages', height, title: 'Most used languages', desc, body: parts.join('\n'), theme });
}

module.exports = { renderLanguages };
