"use client";

import { useEffect, useMemo, useState } from "react";

type DistributionPoint = { date: string; probability: number };
type Forecast = {
  episode: number;
  issuedDate: string;
  windowStart: string;
  windowEnd: string;
  windowText: string;
  source: string;
  sourceUrl: string;
};
type PortalData = {
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
};

const LIVE_DATA_URL =
  "https://raw.githubusercontent.com/zhaozhechen/TurkeySci/main/public/data/current.json";

function dateLabel(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${value}T00:00:00Z`));
}

function longDate(value: string) {
  return dateLabel(value, { month: "long", weekday: "long" });
}

function probabilityLabel(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

export function TurkeySciDashboard({ initialData }: { initialData: PortalData }) {
  const [data, setData] = useState(initialData);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${LIVE_DATA_URL}?v=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Live data unavailable");
        return response.json();
      })
      .then((next: PortalData) => {
        setData(next);
        setLive(true);
      })
      .catch(() => setLive(false));
    return () => controller.abort();
  }, []);

  const peak = useMemo(
    () => Math.max(...(data.model?.distribution.map((point) => point.probability) || [1])),
    [data.model],
  );
  const usgsWindow = data.usgs.forecastWindow;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="TurkeySci home">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span>TurkeySci</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#forecast">Forecast</a>
          <a href="#method">Method</a>
          <a href="#about">About</a>
        </nav>
        <a className="source-link" href={data.usgs.sourceUrl} target="_blank" rel="noreferrer">
          Official USGS update <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-rings" aria-hidden="true"><span /><span /><span /></div>
        <div className="eyebrow"><span className="pulse" /> Kīlauea · Episode {data.currentEpisode}</div>
        <h1>When might<br />Kīlauea erupt next?</h1>
        <p className="hero-intro">
          A transparent Bayesian model that turns official USGS forecast windows into an
          automatically updated view of likely eruption timing.
        </p>
        <div className="hero-meta">
          <span>USGS alert: <strong>{data.usgs.alertLevel}</strong></span>
          <span>Aviation: <strong>{data.usgs.aviationColor}</strong></span>
          <span className={live ? "live-state online" : "live-state"}>
            {live ? "Live data connected" : "Latest verified snapshot"}
          </span>
        </div>
      </section>

      <section className="forecast-section" id="forecast">
        <div className="section-label">01 · Current outlook</div>
        <div className="forecast-grid">
          <article className="prediction-card">
            <div className="card-kicker">TurkeySci model center</div>
            {data.model ? (
              <>
                <div className="prediction-date">
                  <span>{longDate(data.model.mapDate).split(",")[0]}</span>
                  <strong>{dateLabel(data.model.mapDate, { month: "long" })}</strong>
                </div>
                <div className="intervals">
                  <div><span>50% interval</span><strong>{dateLabel(data.model.ci50[0])}—{dateLabel(data.model.ci50[1])}</strong></div>
                  <div><span>95% interval</span><strong>{dateLabel(data.model.ci95[0])}—{dateLabel(data.model.ci95[1])}</strong></div>
                </div>
                <p className="observation-note">
                  Based on {data.model.observations} forecast {data.model.observations === 1 ? "window" : "windows"} for episode {data.currentEpisode}.
                </p>
              </>
            ) : (
              <p className="empty-state">Waiting for a new official USGS forecast window.</p>
            )}
          </article>

          <article className="official-card">
            <div className="official-head">
              <span>Official source</span>
              <strong>USGS · HVO</strong>
            </div>
            <p className="official-summary">“{data.usgs.summary}”</p>
            {usgsWindow && (
              <div className="official-window">
                <span>Published window</span>
                <strong>{dateLabel(usgsWindow.start, { month: "long" })} — {dateLabel(usgsWindow.end, { month: "long" })}</strong>
              </div>
            )}
            <div className="official-footer">
              Issued {data.usgs.issuedLabel.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*/, "")}
            </div>
          </article>
        </div>

        {data.model && (
          <article className="distribution-card" aria-labelledby="distribution-title">
            <div className="chart-heading">
              <div>
                <div className="card-kicker">Daily posterior</div>
                <h2 id="distribution-title">Relative probability by date</h2>
              </div>
              <div className="chart-legend"><span /> Model probability mass</div>
            </div>
            <div className="chart" role="img" aria-label={`Posterior distribution peaking on ${longDate(data.model.mapDate)}`}>
              {data.model.distribution.map((point, index) => {
                const showLabel = index % 2 === 0 || point.date === data.model?.mapDate;
                return (
                  <div className={`bar-column ${point.date === data.model?.mapDate ? "peak" : ""}`} key={point.date}>
                    <span className="bar-value">{point.date === data.model?.mapDate ? probabilityLabel(point.probability) : ""}</span>
                    <div className="bar-track">
                      <div className="bar" style={{ height: `${Math.max((point.probability / peak) * 100, 0.4)}%` }} />
                    </div>
                    <span className="bar-date">{showLabel ? dateLabel(point.date) : ""}</span>
                  </div>
                );
              })}
            </div>
            <p className="chart-note">
              The area sums to 100%. These are model-derived relative probabilities, not calibrated hazard probabilities.
            </p>
          </article>
        )}

        <article className="history-card">
          <div className="history-heading">
            <div>
              <div className="card-kicker">Inputs</div>
              <h2>Recent USGS forecast windows</h2>
            </div>
            <span>{data.recentForecasts.length} captured</span>
          </div>
          <div className="history-list">
            {data.recentForecasts.length ? data.recentForecasts.map((forecast, index) => (
              <div className="history-row" key={`${forecast.episode}-${forecast.issuedDate}`}>
                <span className="history-number">{String(data.recentForecasts.length - index).padStart(2, "0")}</span>
                <time dateTime={forecast.issuedDate}>{dateLabel(forecast.issuedDate, { month: "long" })}</time>
                <span className="window-line"><i />{dateLabel(forecast.windowStart)}—{dateLabel(forecast.windowEnd)}</span>
                <span className="history-source">USGS</span>
              </div>
            )) : <p className="empty-state">No forecast window has been published for this episode yet.</p>}
          </div>
        </article>
      </section>

      <section className="method-section" id="method">
        <div className="section-label light">02 · How it works</div>
        <div className="method-intro">
          <h2>One simple idea,<br />updated every day.</h2>
          <p>TurkeySci preserves the structure of the original R model while removing the manual download step.</p>
        </div>
        <div className="steps">
          <article><span>1</span><h3>Read</h3><p>Collect the latest forecast window and official episode timeline directly from USGS.</p></article>
          <article><span>2</span><h3>Shape</h3><p>Treat each published window as a bell-shaped likelihood centered on its midpoint.</p></article>
          <article><span>3</span><h3>Weight</h3><p>Give more influence to newer, narrower forecasts, matching the original model.</p></article>
          <article><span>4</span><h3>Combine</h3><p>Normalize the evidence into a daily posterior and publish the result with its uncertainty.</p></article>
        </div>
        <div className="method-detail">
          <span>Current parameters</span>
          <code>σ scale 2.0 · recency 2.0 · narrowness 1.5 · ±7 day grid</code>
        </div>
      </section>

      <section className="about-section" id="about">
        <div>
          <div className="section-label">03 · About the project</div>
          <h2>Open science for a living volcano.</h2>
        </div>
        <div className="about-copy">
          <p>
            TurkeySci is an independent research project by Zhaozhe Chen. It translates public USGS
            forecast windows into a reproducible Bayesian summary so anyone can see how the outlook evolves.
          </p>
          <p className="warning">
            <strong>Experimental model—not an official warning system.</strong> Never use TurkeySci for safety,
            evacuation, travel, or emergency decisions. Follow USGS, Hawaiʻi County Civil Defense, and Hawaiʻi
            Volcanoes National Park guidance.
          </p>
          <div className="about-links">
            <a href="https://github.com/zhaozhechen/TurkeySci" target="_blank" rel="noreferrer">View source on GitHub ↗</a>
            <a href={data.usgs.sourceUrl} target="_blank" rel="noreferrer">Read the latest USGS update ↗</a>
          </div>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /></span><span>TurkeySci</span></a>
        <p>Bayesian eruption timing · Kīlauea, Hawaiʻi</p>
        <p>Data snapshot: {dateLabel(data.usgs.issuedDate, { month: "long", year: "numeric" })}</p>
      </footer>
    </main>
  );
}
