import assert from "node:assert/strict";
import test from "node:test";
import { posteriorOneEpisode } from "../scripts/lib/model.mjs";

test("posterior stays normalized and favors the overlap of recent windows", () => {
  const result = posteriorOneEpisode([
    { issuedDate: "2026-08-08", windowStart: "2026-08-11", windowEnd: "2026-08-15" },
    { issuedDate: "2026-08-09", windowStart: "2026-08-12", windowEnd: "2026-08-15" },
    { issuedDate: "2026-08-10", windowStart: "2026-08-12", windowEnd: "2026-08-14" },
  ]);
  assert.ok(result);
  const total = result.distribution.reduce((sum, point) => sum + point.probability, 0);
  assert.ok(Math.abs(total - 1) < 1e-6);
  assert.equal(result.mapDate, "2026-08-13");
  assert.equal(result.observations, 3);
});

test("returns null when an episode has no complete windows", () => {
  assert.equal(posteriorOneEpisode([]), null);
});
