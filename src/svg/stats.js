'use strict';

const { WIDTH, PAD, escapeXml, formatNumber, renderCard } = require('./common');

const ROW_START = 70;
const ROW_GAP = 26;

function renderStats(stats, theme) {
  const rows = [
    { label: 'Commits (all time, incl. private)', value: stats.commits, accent: true },
    { label: 'Pull requests', value: stats.pullRequests },
    { label: 'Issues', value: stats.issues },
    { label: 'Code reviews', value: stats.reviews },
    { label: 'Stars earned', value: stats.stars },
    { label: 'Followers', value: stats.followers },
    { label: 'Contributed to (last year)', value: stats.contributedTo },
  ];
  const lines = rows.map((row, i) => {
    const y = ROW_START + i * ROW_GAP;
    const marker = `<rect x="${PAD}" y="${y - 10}" width="3" height="12" rx="1.5" class="accent"${row.accent ? '' : ' opacity="0.35"'}/>`;
    return [
      `  <g>`,
      `    ${marker}`,
      `    <text x="${PAD + 12}" y="${y}" class="label">${escapeXml(row.label)}</text>`,
      `    <text x="${WIDTH - PAD}" y="${y}" class="value" text-anchor="end">${formatNumber(row.value)}</text>`,
      `  </g>`,
    ].join('\n');
  });
  const footerY = ROW_START + (rows.length - 1) * ROW_GAP + 34;
  const since = stats.firstYear ? `Since ${stats.firstYear}. ` : '';
  const footer = `  <text x="${PAD}" y="${footerY}" class="small">${escapeXml(
    `${since}Commits include ${formatNumber(stats.privateContributions)} private contributions.`,
  )}</text>`;
  const height = footerY + 22;
  const title = `${stats.name}'s GitHub stats`;
  const desc = rows.map((r) => `${r.label}: ${formatNumber(r.value)}`).join('. ');
  return renderCard({ id: 'truestats-stats', height, title, desc, body: [...lines, footer].join('\n'), theme });
}

module.exports = { renderStats };
