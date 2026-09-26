'use strict';

// Palette map. Every card reads colours only from here.
const THEMES = {
  dark: { bg: '#0d1117', border: '#30363d', title: '#e6edf3', text: '#c9d1d9', muted: '#8b949e', accent: '#58a6ff', track: '#21262d' },
  light: { bg: '#ffffff', border: '#d0d7de', title: '#1f2328', text: '#24292f', muted: '#57606a', accent: '#0969da', track: '#eaeef2' },
  tokyonight: { bg: '#1a1b27', border: '#2f334d', title: '#70a5fd', text: '#c0caf5', muted: '#7a88cf', accent: '#bf91f3', track: '#24283b' },
  // Mid-tone colours that stay readable on both light and dark page backgrounds.
  transparent: { bg: 'none', border: '#8b949e', title: '#2f81f7', text: '#768390', muted: '#768390', accent: '#2f81f7', track: '#8b949e40' },
};

const COLOR_KEYS = Object.keys(THEMES.dark);
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Parse "bg=0d1117,title=58a6ff" into { bg: '#0d1117', title: '#58a6ff' }.
 * Unknown keys and malformed values are reported through `warn` and ignored,
 * which also keeps arbitrary strings out of the SVG markup.
 */
function parseColors(spec, warn = () => {}) {
  const out = {};
  if (!spec) return out;
  for (const part of String(spec).split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [rawKey, rawValue] = trimmed.split('=').map((s) => (s || '').trim());
    const key = rawKey.toLowerCase();
    if (!COLOR_KEYS.includes(key)) {
      warn(`Ignoring unknown colour key "${rawKey}". Valid keys: ${COLOR_KEYS.join(', ')}.`);
      continue;
    }
    if (rawValue.toLowerCase() === 'none' && key === 'bg') {
      out.bg = 'none';
      continue;
    }
    if (!HEX.test(rawValue)) {
      warn(`Ignoring colour ${key}="${rawValue}": expected a hex value such as 0d1117.`);
      continue;
    }
    out[key] = `#${rawValue.replace(/^#/, '').toLowerCase()}`;
  }
  return out;
}

function resolveTheme(name = 'dark', overrides = {}, warn = () => {}) {
  const key = String(name || 'dark').trim().toLowerCase();
  let base = THEMES[key];
  if (!base) {
    warn(`Unknown theme "${name}"; falling back to "dark". Available: ${Object.keys(THEMES).join(', ')}.`);
    base = THEMES.dark;
  }
  return { ...base, ...overrides };
}

module.exports = { THEMES, COLOR_KEYS, parseColors, resolveTheme };
