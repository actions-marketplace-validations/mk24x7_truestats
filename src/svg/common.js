'use strict';

const languageColors = require('./languageColors.json');

const WIDTH = 480;
const PAD = 24;
const FONT = '-apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Helvetica, Arial, sans-serif';

/**
 * Escape text for SVG and encode every non-ASCII character as a numeric
 * character reference, so output files stay pure ASCII without losing content.
 */
function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[^\x00-\x7F]/gu, (ch) => `&#x${ch.codePointAt(0).toString(16).toUpperCase()};`)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function formatPercent(p) {
  if (p > 0 && p < 0.1) return '<0.1%';
  return `${p.toFixed(1)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(key, withYear = true) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return withYear ? `${MONTHS[m - 1]} ${d}, ${y}` : `${MONTHS[m - 1]} ${d}`;
}

function formatRange(start, end) {
  if (!start || !end) return 'No active streak';
  if (start === end) return formatDate(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${formatDate(start, !sameYear)} - ${formatDate(end)}`;
}

function languageColor(name, apiColor) {
  if (name === 'Other') return '#8b949e';
  return languageColors[name] || apiColor || '#8b949e';
}

/**
 * Shared card frame: rounded 8px rectangle, 1px border, title, body.
 * `id` keeps element ids unique when several cards are inlined on one page.
 */
function renderCard({ id, height, title, desc, body, theme }) {
  const t = theme;
  const borderOpacity = t.bg === 'none' ? ' stroke-opacity="0.5"' : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc">`,
    `  <title id="${id}-title">${escapeXml(title)}</title>`,
    `  <desc id="${id}-desc">${escapeXml(desc)}</desc>`,
    '  <style>',
    `    text { font-family: ${FONT}; }`,
    `    .title { font-size: 16px; font-weight: 600; fill: ${t.title}; }`,
    `    .label { font-size: 13px; fill: ${t.muted}; }`,
    `    .value { font-size: 13px; font-weight: 600; fill: ${t.text}; }`,
    `    .small { font-size: 11px; fill: ${t.muted}; }`,
    `    .big { font-size: 28px; font-weight: 600; fill: ${t.text}; }`,
    `    .accent { fill: ${t.accent}; }`,
    `    .body { font-size: 13px; fill: ${t.text}; }`,
    '  </style>',
    `  <rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="7.5" fill="${t.bg}" stroke="${t.border}"${borderOpacity}/>`,
    `  <text x="${PAD}" y="36" class="title">${escapeXml(title)}</text>`,
    body,
    '</svg>',
    '',
  ].join('\n');
}

module.exports = { WIDTH, PAD, escapeXml, formatNumber, formatPercent, formatDate, formatRange, languageColor, renderCard };
