'use strict';

const { WIDTH, PAD, CONTENT_Y, escapeXml, formatNumber, footerLayout, footerText, renderCard } = require('./common');

// 25px rows keep seven lines compact enough to pair with the languages card.
const ROW_GAP = 25;

function renderStats(stats, theme, { height } = {}) {
  const rows = [
    { label: 'Commits (all time, incl. private)', value: stats.commits, accent: true },
    { label: 'Pull requests', value: stats.pullRequests },
    { label: 'Issues', value: stats.issues },
    { label: 'Code reviews', value: stats.reviews },
    { label: 'Stars earned', value: stats.stars },
    { label: 'Followers', value: stats.followers },
    { label: 'Contributed to (last year)', value: stats.contributedTo },
  ];
  const body = rows
    .map((row, i) => {
      const y = CONTENT_Y + i * ROW_GAP;
      return [
        '  <g>',
        `    <rect x="${PAD}" y="${y - 10}" width="3" height="12" rx="1.5" class="accent"${row.accent ? '' : ' opacity="0.35"'}/>`,
        `    <text x="${PAD + 12}" y="${y}" class="label">${escapeXml(row.label)}</text>`,
        `    <text x="${WIDTH - PAD}" y="${y}" class="value" text-anchor="end">${formatNumber(row.value)}</text>`,
        '  </g>',
      ].join('\n');
    })
    .join('\n');
  const { footerY, height: naturalHeight } = footerLayout(CONTENT_Y + (rows.length - 1) * ROW_GAP);
  const since = stats.firstYear ? `Since ${stats.firstYear}. ` : '';
  const footer = footerText(footerY, `${since}Commits include ${formatNumber(stats.privateContributions)} private contributions.`);
  const desc = rows.map((r) => `${r.label}: ${formatNumber(r.value)}`).join('. ');
  return renderCard({
    id: 'truestats-stats',
    naturalHeight,
    height,
    title: `${stats.name}'s GitHub stats`,
    desc,
    body,
    footer,
    theme,
  });
}

module.exports = { renderStats };
