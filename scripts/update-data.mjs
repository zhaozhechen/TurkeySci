import { readFile, writeFile } from "node:fs/promises";
import { posteriorOneEpisode } from "./lib/model.mjs";
import { parseDailyUpdate, parseEruptionTimeline } from "./lib/usgs.mjs";

const DAILY_URL = "https://www.usgs.gov/volcanoes/kilauea/volcano-updates";
const TIMELINE_URL = "https://www.usgs.gov/volcanoes/kilauea/science/eruption-information";
const HISTORY_PATH = new URL("../public/data/forecast-history.json", import.meta.url);
const CURRENT_PATH = new URL("../public/data/current.json", import.meta.url);
const headers = {
  "user-agent": "TurkeySci/0.1 (public Kilauea research portal; github.com/zhaozhechen/TurkeySci)",
};

async function fetchText(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

const [dailyHtml, timelineHtml, historyText] = await Promise.all([
  fetchText(DAILY_URL),
  fetchText(TIMELINE_URL),
  readFile(HISTORY_PATH, "utf8"),
]);

const daily = parseDailyUpdate(dailyHtml, DAILY_URL);
const eruptions = parseEruptionTimeline(timelineHtml, TIMELINE_URL);
const history = JSON.parse(historyText);
history.eruptions = eruptions;

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
  recentForecasts: currentForecasts.slice(-8).reverse(),
  methodology: "Original TurkeySci Gaussian-window Bayesian model with recency and narrowness weighting",
};

await Promise.all([
  writeFile(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`),
  writeFile(CURRENT_PATH, `${JSON.stringify(generated, null, 2)}\n`),
]);

console.log(
  `TurkeySci updated from USGS ${daily.issuedDate}: episode ${currentEpisode}, ${currentForecasts.length} forecast observation(s).`,
);
