import { posteriorOneEpisode } from "@/scripts/lib/model.mjs";
import { htmlToText, parseDailyUpdate } from "@/scripts/lib/usgs.mjs";

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
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";

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

function eruptionFromNotice(notice: HansNotice, minimumNewEpisode: number) {
  const text = htmlToText(notice.noticeHtml);
  const event = text.match(
    new RegExp(`episode\\s+(\\d+)[^.!?\\n]{0,180}?(?:began|started|occurred)(?:[^.!?\\n]{0,80}?\\bon\\s+)?(${MONTHS})\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?`, "i"),
  );
  if (!event) {
    const sameDayEvent = text.match(/episode\s+(\d+)[^.!?\n]{0,160}?(?:began|started|occurred|ended)/i);
    if (!sameDayEvent || Number(sameDayEvent[1]) <= minimumNewEpisode) return null;
    return {
      episode: Number(sameDayEvent[1]),
      startDate: notice.sentUtc.slice(0, 10),
      sourceUrl: notice.permLink,
    };
  }
  const issueYear = Number(notice.sentUtc.slice(0, 4));
  const date = new Date(`${event[2]} ${event[3]}, ${event[4] || issueYear} UTC`);
  if (!Number.isFinite(date.getTime())) return null;
  return {
    episode: Number(event[1]),
    startDate: date.toISOString().slice(0, 10),
    sourceUrl: notice.permLink,
  };
}

export async function refreshFromUsgs(initial: PortalData): Promise<PortalData> {
  const notices = await fetchNotices();
  if (!notices.length) return initial;

  const parsed = notices.map((notice) => {
    try {
      return { notice, update: parseDailyUpdate(notice.noticeHtml, notice.permLink) };
    } catch {
      return null;
    }
  }).filter(Boolean) as Array<{ notice: HansNotice; update: PortalData["usgs"] & { episode: number | null } }>;
  if (!parsed.length) return initial;

  const forecasts: Forecast[] = [];
  for (const { update } of parsed) {
    if (!update.episode || !update.forecastWindow) continue;
    forecasts.push({
      episode: update.episode,
      issuedDate: update.issuedDate,
      windowStart: update.forecastWindow.start,
      windowEnd: update.forecastWindow.end,
      windowText: update.forecastWindow.text,
      source: "USGS HANS daily update archive",
      sourceUrl: update.sourceUrl,
    });
  }

  const eruptionMap = new Map(initial.previousEruptions.map((item) => [item.episode, item]));
  for (const notice of notices) {
    const eruption = eruptionFromNotice(notice, initial.latestCompletedEpisode);
    if (eruption) eruptionMap.set(eruption.episode, eruption);
  }
  const previousEruptions = [...eruptionMap.values()]
    .sort((a, b) => b.episode - a.episode)
    .slice(0, 14);
  const latestCompletedEpisode = Math.max(
    initial.latestCompletedEpisode,
    ...previousEruptions.map((item) => item.episode),
  );

  const newest = parsed[0].update;
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
