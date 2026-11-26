import test from "node:test";
import assert from "node:assert/strict";
import "../public/os/event-sync.js";

const { createEventLoader } = globalThis.ContestEventSync;

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function page(items, total = items.length, pages = Math.max(1, Math.ceil(total / 100))) {
  return { items, total, pages };
}

function event(id) {
  return { id, title: `赛事 ${id}` };
}

function loaderWith(routes, { now = () => new Date("2026-11-26T08:00:00Z") } = {}) {
  const calls = [];
  const load = createEventLoader({
    fetchImpl: async (url) => {
      calls.push(url);
      const route = routes.find(([prefix]) => url.startsWith(prefix));
      if (!route) throw new Error(`Unexpected request: ${url}`);
      const result = typeof route[1] === "function" ? route[1]() : route[1];
      if (result instanceof Error) throw result;
      return result;
    },
    normalize: (item) => ({ ...item, normalized: true }),
    now,
  });
  return { load, calls };
}

test("event sync publishes all pages atomically with read and collection times", async () => {
  const { load, calls } = loaderWith([
    ["/api/v1/editions?size=100&page=1", jsonResponse(page([event(1)], 2, 2))],
    ["/api/v1/editions?size=100&page=2", jsonResponse({ items: [event(2)] })],
    ["/api/v1/health", jsonResponse({ last_refresh: "2026-11-26T07:30:00Z" })],
  ]);

  const result = await load();

  assert.deepEqual(result.items.map((item) => item.id), [1, 2]);
  assert.ok(result.items.every((item) => item.normalized));
  assert.equal(result.fetchedAt, "2026-11-26T08:00:00.000Z");
  assert.equal(result.lastRefresh, "2026-11-26T07:30:00Z");
  assert.equal(calls.filter((url) => url.includes("/editions?")).length, 2);
});

test("event sync rejects a failed later page instead of publishing partial data", async () => {
  const { load } = loaderWith([
    ["/api/v1/editions?size=100&page=1", jsonResponse(page([event(1)], 2, 2))],
    ["/api/v1/editions?size=100&page=2", jsonResponse({}, 503)],
    ["/api/v1/health", jsonResponse({ last_refresh: null })],
  ]);

  await assert.rejects(load(), /page=2.*503/);
});

test("event sync rejects an incomplete page set", async () => {
  const { load } = loaderWith([
    ["/api/v1/editions?size=100&page=1", jsonResponse({ items: [event(1)], total: 2, pages: 1 })],
    ["/api/v1/health", jsonResponse({ last_refresh: null })],
  ]);

  await assert.rejects(load(), /incomplete/i);
});

test("event sync accepts a valid empty live result", async () => {
  const { load, calls } = loaderWith([
    ["/api/v1/editions?size=100&page=1", jsonResponse(page([]))],
    ["/api/v1/health", jsonResponse({ last_refresh: null })],
  ]);

  const result = await load();

  assert.deepEqual(result.items, []);
  assert.equal(calls.filter((url) => url.includes("/editions?")).length, 1);
});

test("event sync keeps live data usable when collection health is unavailable", async () => {
  const { load } = loaderWith([
    ["/api/v1/editions?size=100&page=1", jsonResponse(page([event(1)]))],
    ["/api/v1/health", new Error("health unavailable")],
  ]);

  const result = await load();

  assert.equal(result.items.length, 1);
  assert.equal(result.lastRefresh, null);
});

test("event sync rejects malformed list responses", async () => {
  const { load } = loaderWith([
    ["/api/v1/editions?size=100&page=1", jsonResponse({ total: 1, pages: 1 })],
    ["/api/v1/health", jsonResponse({ last_refresh: null })],
  ]);

  await assert.rejects(load(), /invalid/i);
});
