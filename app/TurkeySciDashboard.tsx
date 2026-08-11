"use client";

import { useEffect, useMemo, useState } from "react";
import { refreshFromUsgs, type Forecast, type PortalData } from "./live-data";

const DAY_MS = 86_400_000;

function dayNumber(value: string) {
  return Date.parse(`${value}T00:00:00Z`) / DAY_MS;
}

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

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "compact" : ""}`}>
      <img src="/turkeysci-logo.png" alt="" />
      <span>TurkeySci</span>
    </span>
  );
}

function ForecastEvolution({ forecasts, episode }: { forecasts: Forecast[]; episode: number }) {
  const rows = [...forecasts].sort((a, b) => a.issuedDate.localeCompare(b.issuedDate));
  if (!rows.length) return <p className="empty-state">Waiting for the first USGS forecast window for episode {episode}.</p>;
  const min = Math.min(...rows.map((row) => dayNumber(row.windowStart))) - 1;
  const max = Math.max(...rows.map((row) => dayNumber(row.windowEnd))) + 1;
  const span = Math.max(max - min, 1);

  return (
    <div className="evolution-chart" role="img" aria-label={`How the USGS forecast window changed for episode ${episode}`}>
      <div className="evolution-axis"><span>{dateLabel(new Date(min * DAY_MS).toISOString().slice(0, 10))}</span><span>Predicted eruption date</span><span>{dateLabel(new Date(max * DAY_MS).toISOString().slice(0, 10))}</span></div>
      {rows.map((row) => {
        const left = ((dayNumber(row.windowStart) - min) / span) * 100;
        const width = ((dayNumber(row.windowEnd) - dayNumber(row.windowStart) + 1) / span) * 100;
        return (
          <div className="evolution-row" key={`${row.episode}-${row.issuedDate}`}>
            <time dateTime={row.issuedDate}>{dateLabel(row.issuedDate)}</time>
            <div className="evolution-track">
              <span className="evolution-window" style={{ left: `${left}%`, width: `${width}%` }} />
            </div>
            <span>{dateLabel(row.windowStart)}—{dateLabel(row.windowEnd)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TurkeySciDashboard({ initialData }: { initialData: PortalData }) {
  const [data, setData] = useState(initialData);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    refreshFromUsgs(initialData)
      .then((next) => { if (active) { setData(next); setLive(true); } })
      .catch(() => { if (active) setLive(false); });
    return () => { active = false; };
  }, [initialData]);

  const peak = useMemo(
    () => Math.max(...(data.model?.distribution.map((point) => point.probability) || [1])),
    [data.model],
  );
  const chronologicalForecasts = useMemo(
    () => [...data.recentForecasts].sort((a, b) => a.issuedDate.localeCompare(b.issuedDate)),
    [data.recentForecasts],
  );
  const eruptions = useMemo(
    () => [...data.previousEruptions].sort((a, b) => a.episode - b.episode),
    [data.previousEruptions],
  );
  const eruptionGaps = eruptions.map((eruption, index) => ({
    ...eruption,
    gap: index ? dayNumber(eruption.startDate) - dayNumber(eruptions[index - 1].startDate) : 0,
  }));
  const maxGap = Math.max(...eruptionGaps.map((item) => item.gap), 1);
  const usgsWindow = data.usgs.forecastWindow;

  return (
    <main>
      <header className="topbar">
        <a href="#top" aria-label="TurkeySci home"><Logo compact /></a>
        <nav aria-label="Primary navigation">
          <a href="#forecast">Forecast</a>
          <a href="#evolution">Evolution</a>
          <a href="#history">History</a>
          <a href="#method">Method</a>
        </nav>
        <a className="source-link usgs-link" href={data.usgs.sourceUrl} target="_blank" rel="noreferrer">Official USGS update ↗</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-rings" aria-hidden="true"><span /><span /><span /></div>
        <img className="hero-logo" src="/turkeysci-logo.png" alt="Turkey with a volcano, the TurkeySci logo" />
        <div className="eyebrow"><span className="pulse" /> Kīlauea · Episode {data.currentEpisode}</div>
        <h1>When might<br />Kīlauea erupt next?</h1>
        <p className="hero-intro">An independent Bayesian model that combines the complete sequence of USGS forecast windows for the active episode.</p>
        <div className="hero-meta">
          <span className="usgs-pill">USGS alert: <strong>{data.usgs.alertLevel}</strong></span>
          <span className="usgs-pill">Aviation: <strong>{data.usgs.aviationColor}</strong></span>
          <span className={live ? "live-state online" : "live-state"}>{live ? "Live from USGS" : "Latest verified snapshot"}</span>
        </div>
      </section>

      <section className="forecast-section" id="forecast">
        <div className="section-label">01 · Current outlook</div>
        <div className="forecast-grid">
          <article className="prediction-card">
            <div className="card-kicker">TurkeySci Bayesian estimate</div>
            {data.model ? <>
              <div className="prediction-date"><span>{longDate(data.model.mapDate).split(",")[0]}</span><strong>{dateLabel(data.model.mapDate, { month: "long" })}</strong></div>
              <div className="intervals">
                <div><span>50% credible interval</span><strong>{dateLabel(data.model.ci50[0])}—{dateLabel(data.model.ci50[1])}</strong></div>
                <div><span>95% credible interval</span><strong>{dateLabel(data.model.ci95[0])}—{dateLabel(data.model.ci95[1])}</strong></div>
              </div>
              <p className="observation-note">Combines {data.model.observations} daily USGS forecast windows for episode {data.currentEpisode}; it is not the midpoint of the latest window.</p>
            </> : <p className="empty-state">Waiting for a new official USGS forecast window.</p>}
          </article>

          <article className="official-card">
            <div className="official-head"><span>Official source</span><strong>USGS · HVO</strong></div>
            <p className="official-summary">“{data.usgs.summary}”</p>
            {usgsWindow && <div className="official-window"><span>Current USGS window</span><strong>{dateLabel(usgsWindow.start, { month: "long" })} — {dateLabel(usgsWindow.end, { month: "long" })}</strong></div>}
            <div className="official-footer">Issued {data.usgs.issuedLabel.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*/, "")}</div>
          </article>
        </div>

        {data.model && <article className="distribution-card" aria-labelledby="distribution-title">
          <div className="chart-heading">
            <div><div className="card-kicker">Bayesian posterior</div><h2 id="distribution-title">Relative probability by date</h2></div>
            <div className="chart-legends"><span><i className="model-key" />TurkeySci</span><span><i className="usgs-key" />USGS window</span></div>
          </div>
          <div className="chart" role="img" aria-label={`Posterior distribution peaking on ${longDate(data.model.mapDate)}; the current USGS window is shaded green`}>
            {data.model.distribution.map((point, index) => {
              const inUsgs = Boolean(usgsWindow && point.date >= usgsWindow.start && point.date <= usgsWindow.end);
              const showLabel = index % 2 === 0 || point.date === data.model?.mapDate;
              return <div className={`bar-column ${point.date === data.model?.mapDate ? "peak" : ""} ${inUsgs ? "in-usgs" : ""}`} key={point.date}>
                <span className="bar-value">{point.date === data.model?.mapDate ? probabilityLabel(point.probability) : ""}</span>
                <div className="bar-track"><div className="bar" style={{ height: `${Math.max((point.probability / peak) * 100, .4)}%` }} /></div>
                <span className="bar-date">{showLabel ? dateLabel(point.date) : ""}</span>
              </div>;
            })}
          </div>
          <p className="chart-note">Green shading is the latest official USGS window. Orange bars are the posterior obtained by combining all {data.model.observations} windows shown below.</p>
        </article>}

        <article className="history-card" id="evolution">
          <div className="history-heading"><div><div className="card-kicker">Episode {data.currentEpisode} inputs</div><h2>How the USGS forecast changed each day</h2></div><span>{chronologicalForecasts.length} daily windows</span></div>
          <p className="figure-intro">Each horizontal bar is the forecast published on that date. The chart automatically resets to the next episode after an eruption is recorded.</p>
          <ForecastEvolution forecasts={chronologicalForecasts} episode={data.currentEpisode} />
        </article>

        <article className="eruption-card" id="history">
          <div className="history-heading"><div><div className="card-kicker">Observed history</div><h2>Recent eruption dates and pauses</h2></div><span>USGS timeline</span></div>
          <div className="eruption-chart" role="img" aria-label="Days between recent Kīlauea eruption episodes">
            {eruptionGaps.map((item) => <div className="eruption-column" key={item.episode}>
              <span className="gap-label">{item.gap ? `${item.gap}d` : ""}</span>
              <div className="gap-bar" style={{ height: `${item.gap ? Math.max((item.gap / maxGap) * 100, 12) : 4}%` }} />
              <strong>EP{item.episode}</strong><time dateTime={item.startDate}>{dateLabel(item.startDate)}</time>
            </div>)}
          </div>
          <p className="chart-note">Bar height shows the number of days since the previous episode. Dates are observed episode starts, not model estimates.</p>
        </article>
      </section>

      <section className="method-section" id="method">
        <div className="section-label">02 · What the model actually does</div>
        <div className="method-intro"><h2>Every forecast matters.</h2><p>TurkeySci uses the complete sequence of daily USGS windows for the active episode—not just the latest range and not simply its midpoint.</p></div>
        <div className="equation-card"><span>Posterior(date)</span><strong>∝</strong><span>uniform prior</span><strong>×</strong><span>weighted likelihood₁</span><strong>× ··· ×</strong><span>weighted likelihoodₙ</span></div>
        <div className="steps">
          <article><span>1</span><h3>Collect</h3><p>Retrieve every daily forecast window for the active episode from the official USGS HANS archive.</p></article>
          <article><span>2</span><h3>Translate</h3><p>Represent each window as a Gaussian likelihood centered on that window, with uncertainty tied to its width.</p></article>
          <article><span>3</span><h3>Weight</h3><p>Increase the influence of newer and narrower forecasts using the original model parameters.</p></article>
          <article><span>4</span><h3>Combine</h3><p>Multiply all weighted likelihoods with a uniform prior and normalize the result across calendar dates.</p></article>
        </div>
        <div className="method-detail"><span>Current parameters</span><code>σ scale 2.0 · recency 2.0 · narrowness 1.5 · ±7 day grid</code></div>
      </section>

      <section className="about-section" id="about">
        <div><div className="section-label">03 · About</div><h2>Independent science for a living volcano.</h2></div>
        <div className="about-copy">
          <p>TurkeySci is an independent research project by <strong>Endlessczz</strong>. It makes the evolution of public USGS forecasts easier to see and provides a reproducible Bayesian synthesis of those forecasts.</p>
          <p className="warning"><strong>Experimental model—not an official warning system.</strong> Never use TurkeySci for safety, evacuation, travel, or emergency decisions. Follow USGS, Hawaiʻi County Civil Defense, and Hawaiʻi Volcanoes National Park guidance.</p>
          <div className="about-links"><a className="usgs-link" href={data.usgs.sourceUrl} target="_blank" rel="noreferrer">Read the latest USGS update ↗</a></div>
        </div>
      </section>

      <footer><a href="#top"><Logo compact /></a><p>Bayesian eruption timing · Kīlauea, Hawaiʻi</p><p>By Endlessczz · USGS data {dateLabel(data.usgs.issuedDate, { month: "long", year: "numeric" })}</p></footer>
    </main>
  );
}
