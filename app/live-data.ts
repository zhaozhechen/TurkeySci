import { posteriorOneEpisode } from "@/scripts/lib/model.mjs";
import { parseDailyUpdate, parseEruptionTimeline } from "@/scripts/lib/usgs.mjs";

export type DistributionPoint = { date: string; probability: number };
export type Forecast = {
  episode: number;
  issuedDate: string;
  windowStart: string;
  windowEnd: string;
  windowText: string;
  source: string;
  sourceUrl: string;
};
export type Eruption = { episode: number; startDate: string; sourceUrl: string };
export type PortalData = {
  generatedAt: string;
  currentEpisode: number;
  latestCompletedEpisode: number;
  usgs: {
    issuedDate: string;
    issuedLabel: string;
    alertLevel: string;
    aviationColor: string;
    summary: string;
    forecastWindow: { start: string; end: string; text: string } | null;
    sourceUrl: string;
  };
  model: null | {
    mapDate: string;
    meanDate: string;
    ci50: [string, string];
    ci95: [string, string];
    observations: number;
    distribution: DistributionPoint[];
  };
  recentForecasts: Forecast[];
  previousEruptions: Eruption[];
};

type HansNotice = {
  sentUtc: string;
  noticeHtml: string;
  permLink: string;
};

const HANS_SEARCH_URL = "https://volcanoes.usgs.gov/hans-public/api/search/search";
const TIMELINE_URL = "https://www.usgs.gov/volcanoes/kilauea/science/eruption-information";

async function fetchNotices(): Promise<HansNotice[]> {
  const notices: HansNotice[] = [];
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 70);
  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    const response = await fetch(HANS_SEARCH_URL, {
      method: "POST",
      body: JSON.stringify({
        obsAbbr: "hvo",
        noticeTypeCd: "DU",
        volcCd: "hi3",
        startUnixtime: Math.floor(start.getTime() / 1000),
        endUnixtime: "",
        searchText: "",
        pageIndex,
      }),
    });
    if (!response.ok) throw new Error("USGS archive is temporarily unavailable");
    const page = await response.json();
    notices.push(...page.noticeData);
    if (page.noticeData.length < 20) break;
  }
  return notices;
}

async function fetchOfficialTimeline(initial: PortalData) {
  try {
    const response = await fetch(TIMELINE_URL);
    if (!response.ok) return initial.previousEruptions;
    return parseEruptionTimeline(await response.text(), TIMELINE_URL);
  } catch {
    return initial.previousEruptions;
  }
}

export async function refreshFromUsgs(initial: PortalData): Promise<PortalData> {
  const [notices, officialEruptions] = await Promise.all([
    fetchNotices(),
    fetchOfficialTimeline(initial),
  ]);
  if (!notices.length) return initial;

  const parsed = notices.map((notice) => {
    try {
      return { notice, update: parseDailyUpdate(notice.noticeHtml, notice.permLink) };
    } catch {
      return null;
    }
  }).filter(Boolean) as Array<{ notice: HansNotice; update: PortalData["usgs"] & { episode: number | null } }>;
  if (!parsed.length) return initial;

  const parsedNewestFirst = parsed.sort((a, b) => b.update.issuedDate.localeCompare(a.update.issuedDate));
  const forecastsByDay = new Map<string, Forecast>();
  for (const { update } of parsedNewestFirst) {
    if (!update.episode || !update.forecastWindow) continue;
    const forecast = {
      episode: update.episode,
      issuedDate: update.issuedDate,
      windowStart: update.forecastWindow.start,
      windowEnd: update.forecastWindow.end,
      windowText: update.forecastWindow.text,
      source: "USGS HANS daily update archive",
      sourceUrl: update.sourceUrl,
    };
    forecastsByDay.set(`${forecast.episode}:${forecast.issuedDate}`, forecast);
  }
  const forecasts = [...forecastsByDay.values()];

  const previousEruptions = [...new Map(officialEruptions.map((item) => [item.episode, item])).values()]
    .sort((a, b) => b.episode - a.episode)
    .slice(0, 18);
  const latestCompletedEpisode = Math.max(
    initial.latestCompletedEpisode,
    ...previousEruptions.map((item) => item.episode),
  );

  const newest = parsedNewestFirst[0].update;
  const newestForecast = forecasts.sort((a, b) => b.issuedDate.localeCompare(a.issuedDate))[0];
  const currentEpisode = newestForecast && newestForecast.issuedDate === newest.issuedDate
    ? newestForecast.episode
    : latestCompletedEpisode + 1;
  const currentForecasts = forecasts
    .filter((forecast) => forecast.episode === currentEpisode)
    .sort((a, b) => a.issuedDate.localeCompare(b.issuedDate));

  return {
    ...initial,
    generatedAt: new Date().toISOString(),
    currentEpisode,
    latestCompletedEpisode,
    usgs: newest,
    model: posteriorOneEpisode(currentForecasts),
    recentForecasts: currentForecasts.slice(-24).reverse(),
    previousEruptions,
  };
}
