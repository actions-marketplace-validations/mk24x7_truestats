'use strict';

// A scripted fetch replacement: each call pops the next response or computes one.
function mockFetch(handler) {
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, init, body });
    const r = await handler(body, calls.length - 1);
    if (r instanceof Error) throw r;
    const status = r.status || 200;
    const headers = new Map(Object.entries(r.headers || {}));
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (k) => (headers.has(k) ? headers.get(k) : null) },
      json: async () => r.json,
      text: async () => r.text || JSON.stringify(r.json || {}),
    };
  };
  return { fetch, calls };
}

const noSleep = async () => {};

module.exports = { mockFetch, noSleep };
