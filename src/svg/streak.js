'use strict';

const { WIDTH, PAD, CONTENT_Y, escapeXml, formatNumber, formatRange, formatDate, footerLayout, footerText, renderCard } = require('./common');

const VALUE_Y = CONTENT_Y + 28; // 28px numbers: cap height starts near CONTENT_Y
const LABEL_Y = VALUE_Y + 26;
const SUB_Y = LABEL_Y + 20;

function renderStreak(model, theme, { height } = {}) {
  const colWidth = (WIDTH - PAD * 2) / 3;
  const columns = [
    {
      value: formatNumber(model.totalThisYear),
      label: `Contributions in ${model.year}`,
      sub: `Jan 1 - ${model.today ? formatDate(model.today, false) : 'today'}`,
    },
    {
      value: formatNumber(model.current.length),
      label: model.current.length === 1 ? 'Current streak (day)' : 'Current streak (days)',
      sub: formatRange(model.current.start, model.current.end),
      accent: true,
    },
    {
      value: formatNumber(model.longest.length),
      label: model.longest.length === 1 ? 'Longest streak (day)' : 'Longest streak (days)',
      sub: formatRange(model.longest.start, model.longest.end),
    },
  ];
  const parts = [];
  columns.forEach((c, i) => {
    const cx = PAD + colWidth * i + colWidth / 2;
    parts.push('  <g>');
    parts.push(`    <text x="${cx}" y="${VALUE_Y}" class="big${c.accent ? ' accent' : ''}" text-anchor="middle">${escapeXml(c.value)}</text>`);
    parts.push(`    <text x="${cx}" y="${LABEL_Y}" class="label" text-anchor="middle">${escapeXml(c.label)}</text>`);
    parts.push(`    <text x="${cx}" y="${SUB_Y}" class="small" text-anchor="middle">${escapeXml(c.sub)}</text>`);
    parts.push('  </g>');
    if (i > 0) {
      const x = PAD + colWidth * i;
      parts.push(`  <line x1="${x}" y1="${CONTENT_Y}" x2="${x}" y2="${SUB_Y + 4}" stroke="${theme.border}" stroke-width="1"/>`);
    }
  });
  const { footerY, height: naturalHeight } = footerLayout(SUB_Y);
  const footer = footerText(footerY, 'A streak is consecutive days (UTC) with at least one contribution.');
  const desc = columns.map((c) => `${c.label}: ${c.value} (${c.sub})`).join('. ');
  return renderCard({ id: 'truestats-streak', naturalHeight, height, title: 'Contribution streak', desc, body: parts.join('\n'), footer, theme });
}

module.exports = { renderStreak };
