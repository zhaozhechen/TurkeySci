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

test("deduplicates repeated responsive timeline rows and preserves episode order", () => {
  const html = `<h2>Timeline of Eruptive Episodes</h2><table><tbody>
    <tr><td>51</td><td>July 15, 2026 - 8:30 a.m.</td></tr>
    <tr><td>52</td><td>July 28, 2026 - 7:10 p.m.</td></tr>
  </tbody></table><table><tbody>
    <tr><td>51</td><td>July 15, 2026 - 8:30 a.m.</td></tr>
    <tr><td>52</td><td>July 28, 2026 - 7:10 p.m.</td></tr>
  </tbody></table>`;
  assert.deepEqual(parseEruptionTimeline(html, "https://example.test"), [
    { episode: 51, startDate: "2026-07-15", sourceUrl: "https://example.test" },
    { episode: 52, startDate: "2026-07-28", sourceUrl: "https://example.test" },
  ]);
});

test("parses weekday-qualified forecast windows from archived notices", () => {
  const html = `<b>Monday, May 4, 2026, 10:03 AM HST</b>
    Current Volcano Alert Level: ADVISORY<br>Current Aviation Color Code: YELLOW
    <span name="synopsis"><b>Summary:</b> The forecast window for episode 46, based on tilt data,
    suggests that lava fountaining will occur again sometime between Monday, May 4 and Thursday, May 7.</span>`;
  const result = parseDailyUpdate(html, "https://example.test");
  assert.equal(result.episode, 46);
  assert.equal(result.forecastWindow.start, "2026-05-04");
  assert.equal(result.forecastWindow.end, "2026-05-07");
});

test("parses the newer USGS episode-likely wording", () => {
  const html = `<b>Thursday, August 20, 2026, 9:06 AM HST</b>
    Current Volcano Alert Level: ADVISORY<br>Current Aviation Color Code: YELLOW
    <span name="synopsis"><b>Summary:</b> Kīlauea volcano is not erupting. Data indicate the onset
    of the next fountaining episode is likely between August 22 and August 26.</span>
    <p>The abrupt switch from summit deflation to inflation at the end of episode 53 along with glow
    from the vents indicates that episode 54 fountaining is likely.</p>`;
  const result = parseDailyUpdate(html, "https://example.test");
  assert.equal(result.episode, 54);
  assert.equal(result.forecastWindow.start, "2026-08-22");
  assert.equal(result.forecastWindow.end, "2026-08-26");
});

test("parses the official Episode 53 start date", () => {
  const html = `<h2>Timeline of Eruptive Episodes</h2><table><tbody>
    <tr><td>53</td><td>August 12, 2026 - 3:45 p.m.</td><td>August 13, 2026 - 1:23 a.m.</td></tr>
  </tbody></table>`;
  assert.deepEqual(parseEruptionTimeline(html, "https://example.test"), [
    { episode: 53, startDate: "2026-08-12", sourceUrl: "https://example.test" },
  ]);
});
