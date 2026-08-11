import assert from "node:assert/strict";
import test from "node:test";
import { parseDailyUpdate, parseEruptionTimeline } from "../scripts/lib/usgs.mjs";

test("parses the daily update and a same-month forecast window", () => {
  const html = `<b>Monday, August 10, 2026, 9:59 AM HST</b>
    Current Volcano Alert Level: ADVISORY<br>Current Aviation Color Code: YELLOW
    <span name="synopsis"><b>Summary:</b> Kīlauea is not erupting.</span>
    <p>The forecast window for episode 53 has shifted to Wednesday-Saturday, August 12–15.</p>`;
  const result = parseDailyUpdate(html, "https://example.test");
  assert.equal(result.issuedDate, "2026-08-10");
  assert.equal(result.episode, 53);
  assert.deepEqual(result.forecastWindow, {
    start: "2026-08-12",
    end: "2026-08-15",
    text: "forecast window for episode 53 has shifted to Wednesday-Saturday, August 12–15",
  });
});

test("parses episode starts from the USGS table", () => {
  const html = `<h2>Timeline of Eruptive Episodes</h2><table><tbody>
    <tr><td>52</td><td>July 28, 2026 - 7:10 p.m.</td><td>July 29, 2026</td></tr>
  </tbody></table>`;
  assert.deepEqual(parseEruptionTimeline(html, "https://example.test"), [
    { episode: 52, startDate: "2026-07-28", sourceUrl: "https://example.test" },
  ]);
});
