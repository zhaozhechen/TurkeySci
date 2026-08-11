const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_NUMBER = new Map(MONTHS.map((month, index) => [month.toLowerCase(), index + 1]));

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, "–")
    .replace(/&[a-z]+;/gi, " ");
}

export function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function stripTags(value) {
  return htmlToText(value).replace(/\s+/g, " ").trim();
}

export function parseForecastWindow(text, issuedDate) {
  const monthPattern = MONTHS.join("|");
  const patterns = [
    new RegExp(`(?:between|from)\\s+(${monthPattern})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\s+(?:and|to|[-–—])\\s+(?:(${monthPattern})\\s+)?(\\d{1,2})(?:,?\\s+(\\d{4}))?`, "i"),
    new RegExp(`(?:window|forecast)[^.!\\n]{0,100}?(${monthPattern})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\s*[-–—]\\s*(?:(${monthPattern})\\s+)?(\\d{1,2})(?:,?\\s+(\\d{4}))?`, "i"),
  ];
  const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);
  if (!match) return null;

  const issueYear = Number(issuedDate.slice(0, 4));
  const startMonth = MONTH_NUMBER.get(match[1].toLowerCase());
  const endMonth = match[4]
    ? MONTH_NUMBER.get(match[4].toLowerCase())
    : startMonth;
  const startYear = Number(match[3] || issueYear);
  const endYear = Number(match[6] || (endMonth < startMonth ? startYear + 1 : startYear));

  return {
    start: isoDate(startYear, startMonth, Number(match[2])),
    end: isoDate(endYear, endMonth, Number(match[5])),
    text: match[0].replace(/\s+/g, " ").trim(),
  };
}

export function parseDailyUpdate(html, sourceUrl) {
  const text = htmlToText(html);
  const dateMatch = text.match(
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4}),\s+[^\n]*?HST/,
  );
  if (!dateMatch) throw new Error("USGS daily update date was not found");
  const issuedDate = isoDate(
    Number(dateMatch[3]),
    MONTH_NUMBER.get(dateMatch[1].toLowerCase()),
    Number(dateMatch[2]),
  );
  const summaryMatch = html.match(/<span\s+name=["']synopsis["'][^>]*>([\s\S]*?)<\/span>/i);
  const summary = summaryMatch ? stripTags(summaryMatch[1]).replace(/^Summary:\s*/i, "") : "";
  const episodeMatch = text.match(/forecast window for episode\s+(\d+)/i)
    || text.match(/episode\s+(\d+)[^\n.]{0,100}?forecast/i)
    || text.match(/forecast[^\n.]{0,100}?episode\s+(\d+)/i);
  const window = parseForecastWindow(text, issuedDate);

  return {
    issuedDate,
    issuedLabel: dateMatch[0],
    episode: episodeMatch ? Number(episodeMatch[1]) : null,
    alertLevel: text.match(/Current Volcano Alert Level:\s*([A-Z]+)/i)?.[1]?.toUpperCase() || "UNKNOWN",
    aviationColor: text.match(/Current Aviation Color Code:\s*([A-Z]+)/i)?.[1]?.toUpperCase() || "UNKNOWN",
    summary,
    forecastWindow: window,
    sourceUrl,
  };
}

export function parseEruptionTimeline(html, sourceUrl) {
  const start = html.toLowerCase().indexOf("timeline of eruptive episodes");
  if (start < 0) throw new Error("USGS eruption timeline was not found");
  const section = html.slice(start);
  const rows = [];
  for (const rowMatch of section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((match) => stripTags(match[1]));
    if (!/^\d+$/.test(cells[0] || "") || !cells[1]) continue;
    const dateMatch = cells[1].match(new RegExp(`(${MONTHS.join("|")})\\s+(\\d{1,2}),\\s+(\\d{4})`, "i"));
    if (!dateMatch) continue;
    rows.push({
      episode: Number(cells[0]),
      startDate: isoDate(
        Number(dateMatch[3]),
        MONTH_NUMBER.get(dateMatch[1].toLowerCase()),
        Number(dateMatch[2]),
      ),
      sourceUrl,
    });
  }
  if (!rows.length) throw new Error("No eruption timeline rows were parsed");
  return rows;
}
