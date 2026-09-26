'use strict';

const { WIDTH, PAD, escapeXml, formatNumber, formatRange, formatDate, renderCard } = require('./common');

function renderStreak(model, theme) {
  const colWidth = (WIDTH - PAD * 2) / 3;
  const columns = [
    {
      value: formatNumber(model.totalThisYear),
      label: `Contributions in ${model.year}`,
      sub: `Jan 1 - ${model.today ? formatDate(model.today, false) : 'today'}`,
    },
    {
      value: `${formatNumber(model.current.length)}`,
      label: model.current.length === 1 ? 'Current streak (day)' : 'Current streak (days)',
      sub: formatRange(model.current.start, model.current.end),
      accent: true,
    },
    {
      value: `${formatNumber(model.longest.length)}`,
      label: model.longest.length === 1 ? 'Longest streak (day)' : 'Longest streak (days)',
      sub: formatRange(model.longest.start, model.longest.end),
    },
  ];
  const parts = [];
  columns.forEach((c, i) => {
    const cx = PAD + colWidth * i + colWidth / 2;
    parts.push('  <g>');
    parts.push(`    <text x="${cx}" y="98" class="big${c.accent ? ' accent' : ''}" text-anchor="middle">${escapeXml(c.value)}</text>`);
    parts.push(`    <text x="${cx}" y="124" class="label" text-anchor="middle">${escapeXml(c.label)}</text>`);
    parts.push(`    <text x="${cx}" y="144" class="small" text-anchor="middle">${escapeXml(c.sub)}</text>`);
    parts.push('  </g>');
    if (i > 0) {
      const x = PAD + colWidth * i;
      parts.push(`  <line x1="${x}" y1="68" x2="${x}" y2="148" stroke="${theme.border}" stroke-width="1"/>`);
    }
  });
  const height = 172;
  const desc = columns.map((c) => `${c.label}: ${c.value} (${c.sub})`).join('. ');
  return renderCard({ id: 'truestats-streak', height, title: 'Contribution streak', desc, body: parts.join('\n'), theme });
}

module.exports = { renderStreak };
