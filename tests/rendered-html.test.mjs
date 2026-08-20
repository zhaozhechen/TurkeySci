import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL(`../dist/server/index.js?test=${Date.now()}`, import.meta.url);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the TurkeySci portal and safety context", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>TurkeySci/);
  assert.match(html, /When might/);
  assert.match(html, /Experimental model/);
  assert.match(html, /Official USGS update/);
  assert.match(html, /Endlessczz/);
  assert.match(html, /turkeysci-logo\.png/);
  assert.match(html, /Kīlauea gallery/);
  assert.match(html, /Most likely 50% range/);
  assert.match(html, /The chart starts with today and shows future dates only/);
  assert.match(html, /endlessczz@gmail\.com/);
  assert.match(html, /Remote sensing is next/);
  assert.doesNotMatch(html, /credible interval/i);
  assert.doesNotMatch(html, /Zhaozhe Chen|github\.com|raw\.githubusercontent/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
