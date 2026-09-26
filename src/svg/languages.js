'use strict';

const { WIDTH, PAD, CONTENT_Y, escapeXml, formatNumber, formatPercent, languageColor, footerLayout, footerText, renderCard } = require('./common');

const BAR_H = 10;
const BAR_Y = CONTENT_Y - BAR_H; // bar sits where the first line of text would
const LEGEND_START = CONTENT_Y + 28;
const LEGEND_GAP = 24;

function renderLanguages(model, theme, { height } = {}) {
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
      const cx = PAD + (i % 2) * colWidth;
      const y = LEGEND_START + Math.floor(i / 2) * LEGEND_GAP;
      parts.push('  <g>');
      parts.push(`    <circle cx="${cx + 5}" cy="${y - 4}" r="5" fill="${languageColor(lang.name, lang.color)}"/>`);
      parts.push(`    <text x="${cx + 16}" y="${y}" class="body">${escapeXml(lang.name)}</text>`);
      parts.push(`    <text x="${cx + colWidth - 12}" y="${y}" class="label" text-anchor="end">${formatPercent(lang.percent)}</text>`);
      parts.push('  </g>');
    });
  }

  const rows = Math.max(1, Math.ceil(languages.length / 2));
  const { footerY, height: naturalHeight } = footerLayout(LEGEND_START + (rows - 1) * LEGEND_GAP);
  const privateNote = privateCount > 0 ? ` (${formatNumber(privateCount)} private)` : ' (public only)';
  const excluded = model.excludeArchived ? 'Archived and forks excluded.' : 'Forks excluded.';
  const footer = footerText(footerY, `By bytes across ${formatNumber(repoCount)} repositories${privateNote}. ${excluded}`);
  const desc = languages.length ? languages.map((l) => `${l.name} ${formatPercent(l.percent)}`).join(', ') : 'No language data';
  return renderCard({ id: 'truestats-languages', naturalHeight, height, title: 'Most used languages', desc, body: parts.join('\n'), footer, theme });
}

module.exports = { renderLanguages };
