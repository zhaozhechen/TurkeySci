import { readFile, writeFile } from "node:fs/promises";
import { posteriorOneEpisode } from "./lib/model.mjs";
import { parseDailyUpdate, parseEruptionTimeline } from "./lib/usgs.mjs";

const DAILY_URL = "https://www.usgs.gov/volcanoes/kilauea/volcano-updates";
const TIMELINE_URL = "https://www.usgs.gov/volcanoes/kilauea/science/eruption-information";
const HANS_SEARCH_URL = "https://volcanoes.usgs.gov/hans-public/api/search/search";
const HISTORY_PATH = new URL("../public/data/forecast-history.json", import.meta.url);
const CURRENT_PATH = new URL("../public/data/current.json", import.meta.url);
const headers = {
  "user-agent": "TurkeySci/0.2 (independent public Kilauea research portal)",
};

async function fetchText(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

async function fetchHansDailyUpdates(startDate = "2026-03-01") {
  const notices = [];
  for (let pageIndex = 0; pageIndex < 16; pageIndex += 1) {
    const response = await fetch(HANS_SEARCH_URL, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        obsAbbr: "hvo",
        noticeTypeCd: "DU",
        volcCd: "hi3",
        startUnixtime: Date.parse(`${startDate}T00:00:00Z`) / 1000,
        endUnixtime: "",
        searchText: "",
        pageIndex,
      }),
    });
    if (!response.ok) throw new Error(`USGS HANS search returned HTTP ${response.status}`);
    const page = await response.json();
    notices.push(...page.noticeData);
    if (page.noticeData.length < 20) break;
  }
  return notices;
}

const [dailyHtml, timelineHtml, historyText, archivedNotices] = await Promise.all([
  fetchText(DAILY_URL),
  fetchText(TIMELINE_URL),
  readFile(HISTORY_PATH, "utf8"),
  fetchHansDailyUpdates(),
]);

const daily = parseDailyUpdate(dailyHtml, DAILY_URL);
const eruptions = parseEruptionTimeline(timelineHtml, TIMELINE_URL);
const history = JSON.parse(historyText);
history.eruptions = eruptions;

for (const notice of archivedNotices) {
  try {
    const parsed = parseDailyUpdate(notice.noticeHtml, notice.permLink);
    if (!parsed.episode || !parsed.forecastWindow) continue;
    const archivedForecast = {
      episode: parsed.episode,
      issuedDate: parsed.issuedDate,
      windowStart: parsed.forecastWindow.start,
      windowEnd: parsed.forecastWindow.end,
      windowText: parsed.forecastWindow.text,
      source: "USGS HANS daily update archive",
      sourceUrl: notice.permLink,
    };
    const key = `${archivedForecast.episode}:${archivedForecast.issuedDate}`;
    const index = history.forecasts.findIndex(
      (row) => `${row.episode}:${row.issuedDate}` === key,
    );
    if (index >= 0) history.forecasts[index] = archivedForecast;
    else history.forecasts.push(archivedForecast);
  } catch {
    // Some daily notices do not contain a forecast; they are intentionally skipped.
  }
}

if (daily.episode && daily.forecastWindow) {
  const key = `${daily.episode}:${daily.issuedDate}`;
  const nextForecast = {
    episode: daily.episode,
    issuedDate: daily.issuedDate,
    windowStart: daily.forecastWindow.start,
    windowEnd: daily.forecastWindow.end,
    windowText: daily.forecastWindow.text,
    source: "USGS daily update",
    sourceUrl: DAILY_URL,
  };
  const index = history.forecasts.findIndex(
    (row) => `${row.episode}:${row.issuedDate}` === key,
  );
  if (index >= 0) history.forecasts[index] = nextForecast;
  else history.forecasts.push(nextForecast);
}

history.forecasts.sort((a, b) =>
  a.episode - b.episode || a.issuedDate.localeCompare(b.issuedDate),
);
history.updatedAt = new Date().toISOString();

const latestEruption = Math.max(...eruptions.map((row) => row.episode));
const currentEpisode = daily.episode || latestEruption + 1;
const currentForecasts = history.forecasts.filter(
  (row) => row.episode === currentEpisode,
);
const model = posteriorOneEpisode(currentForecasts);
const generated = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  currentEpisode,
  latestCompletedEpisode: latestEruption,
  usgs: daily,
  model,
  recentForecasts: currentForecasts.slice(-24).reverse(),
  previousEruptions: eruptions.slice(-18).reverse(),
  methodology: "TurkeySci Bayesian product of all Gaussian forecast-window likelihoods in the active episode, with recency and narrowness weighting",
};

await Promise.all([
  writeFile(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`),
  writeFile(CURRENT_PATH, `${JSON.stringify(generated, null, 2)}\n`),
]);

console.log(
  `TurkeySci updated from USGS ${daily.issuedDate}: episode ${currentEpisode}, ${currentForecasts.length} forecast observation(s).`,
);
