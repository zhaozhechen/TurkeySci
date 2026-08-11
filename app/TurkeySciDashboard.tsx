"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { refreshFromUsgs, type Forecast, type PortalData } from "./live-data";

const DAY_MS = 86_400_000;
const GALLERY = Array.from({ length: 7 }, (_, index) => ({
  src: `/gallery/kilauea-${index + 1}.jpg`,
  alt: `Kīlauea eruption photograph ${index + 1} of 7`,
  portrait: [0, 5, 6].includes(index),
}));

function dayNumber(value: string) {
  return Date.parse(`${value}T00:00:00Z`) / DAY_MS;
}

function isoDay(value: number) {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
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

function GalleryBand() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % GALLERY.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  const move = (direction: number) => {
    setActive((value) => (value + direction + GALLERY.length) % GALLERY.length);
  };

  return (
    <section className="gallery-band" aria-label="Kīlauea gallery">
      <div className="gallery-stage">
        {GALLERY.map((photo, index) => (
          <div key={photo.src} className={`gallery-slide ${photo.portrait ? "portrait" : ""} ${index === active ? "active" : ""}`}>
            <img className="gallery-backdrop" src={photo.src} alt="" aria-hidden="true" />
            <img className="gallery-photo" src={photo.src} alt={photo.alt} loading={index === 0 ? "eager" : "lazy"} />
          </div>
        ))}
        <div className="gallery-shade" />
        <div className="gallery-copy">
          <span>Kīlauea gallery</span>
          <strong>Fountain episodes at the summit</strong>
        </div>
        <button className="gallery-arrow previous" type="button" onClick={() => move(-1)} aria-label="Previous gallery photo">←</button>
        <button className="gallery-arrow next" type="button" onClick={() => move(1)} aria-label="Next gallery photo">→</button>
        <div className="gallery-dots" aria-label="Choose gallery photo">
          {GALLERY.map((photo, index) => (
            <button
              key={photo.src}
              type="button"
              className={index === active ? "active" : ""}
              onClick={() => setActive(index)}
              aria-label={`Show photo ${index + 1}`}
              aria-current={index === active ? "true" : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ForecastEvolution({ forecasts, episode, referenceDate }: { forecasts: Forecast[]; episode: number; referenceDate: string }) {
  const rows = [...forecasts].sort((a, b) => b.issuedDate.localeCompare(a.issuedDate));
  if (!rows.length) return <p className="empty-state">Waiting for the first USGS forecast window for episode {episode}.</p>;
  const min = Math.min(...rows.map((row) => dayNumber(row.windowStart))) - 1;
  const max = Math.max(...rows.map((row) => dayNumber(row.windowEnd))) + 1;
  const days = Array.from({ length: max - min + 1 }, (_, index) => isoDay(min + index));
  const latestIssued = rows[0]?.issuedDate;
  const highlightedDate = rows.some((row) => row.issuedDate === referenceDate) ? referenceDate : latestIssued;
  const span = Math.max(days.length, 1);
  const chartStyle = { "--evolution-days": days.length } as CSSProperties;

  return (
    <div className="evolution-scroll">
      <div className="evolution-chart" style={chartStyle} role="img" aria-label={`Daily USGS forecast windows for episode ${episode}; latest row highlighted`}>
        <div className="evolution-axis-row">
          <span>Update date</span>
          <div className="evolution-ticks">
            {days.map((day) => <time key={day} dateTime={day}>{dateLabel(day)}</time>)}
          </div>
        </div>
        {rows.map((row) => {
          const left = ((dayNumber(row.windowStart) - min) / span) * 100;
          const width = ((dayNumber(row.windowEnd) - dayNumber(row.windowStart) + 1) / span) * 100;
          const highlighted = row.issuedDate === highlightedDate;
          return (
            <div className={`evolution-row ${highlighted ? "today" : ""}`} key={`${row.episode}-${row.issuedDate}`}>
              <time dateTime={row.issuedDate}>
                {dateLabel(row.issuedDate)}
                {highlighted && <small>{row.issuedDate === referenceDate ? "Today" : "Latest"}</small>}
              </time>
              <div className="evolution-track">
                <div className="evolution-grid">{days.map((day) => <i key={day} />)}</div>
                <span className="evolution-window" style={{ left: `${left}%`, width: `${width}%` }}>
                  <b>{dateLabel(row.windowStart)}–{dateLabel(row.windowEnd)}</b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EruptionTimeline({ eruptions }: { eruptions: PortalData["previousEruptions"] }) {
  const sorted = [...eruptions].sort((a, b) => a.episode - b.episode);
  const newestEpisode = sorted.at(-1)?.episode || 0;
  const recent = sorted.filter((item) => item.episode >= newestEpisode - 9).reverse();
  return (
    <div className="eruption-scroll">
      <div className="eruption-timeline" role="img" aria-label="Timeline of the ten most recent completed Kīlauea eruption episodes">
        <div className="timeline-line" aria-hidden="true" />
        {recent.map((item, index) => {
          const older = recent[index + 1];
          const gap = older ? dayNumber(item.startDate) - dayNumber(older.startDate) : null;
          return (
            <div className={`timeline-event ${index === 0 ? "latest" : ""}`} key={item.episode}>
              {gap !== null && <span className="timeline-gap">{gap} days</span>}
              <span className="timeline-dot" />
              <strong>Episode {item.episode}</strong>
              {index === 0 && <small>Latest completed</small>}
              <time dateTime={item.startDate}>{dateLabel(item.startDate, { month: "long", year: "numeric" })}</time>
            </div>
          );
        })}
      </div>
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
    () => [...data.recentForecasts].sort((a, b) => b.issuedDate.localeCompare(a.issuedDate)),
    [data.recentForecasts],
  );
  const usgsWindow = data.usgs.forecastWindow;
  const referenceDate = data.generatedAt.slice(0, 10);
  const visibleDistribution = useMemo(() => {
    if (!data.model) return [];
    const points = data.model.distribution;
    const important = points
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => point.probability >= .000001 || point.date === data.model?.mapDate || point.date === usgsWindow?.start || point.date === usgsWindow?.end)
      .map(({ index }) => index);
    if (!important.length) return points;
    return points.slice(Math.max(0, Math.min(...important) - 1), Math.min(points.length, Math.max(...important) + 2));
  }, [data.model, usgsWindow]);

  return (
    <main>
      <header className="topbar">
        <a href="#top" aria-label="TurkeySci home"><Logo compact /></a>
        <nav aria-label="Primary navigation">
          <a href="#forecast">Forecast</a>
          <a href="#evolution">Evolution</a>
          <a href="#history">History</a>
          <a href="#method">Method</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="source-link usgs-link" href={data.usgs.sourceUrl} target="_blank" rel="noreferrer">Official USGS update ↗</a>
      </header>

      <GalleryBand />

      <section className="hero" id="top">
        <div className="hero-rings" aria-hidden="true"><span /><span /><span /></div>
        <img className="hero-logo" src="/turkeysci-logo.png" alt="Turkey with a volcano on its back, the TurkeySci logo" />
        <div className="episode-badge"><span>Current episode</span><strong>{data.currentEpisode}</strong></div>
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
                <div><span>Most likely 50% range</span><strong>{dateLabel(data.model.ci50[0])}—{dateLabel(data.model.ci50[1])}</strong></div>
                <div><span>Wider 95% range</span><strong>{dateLabel(data.model.ci95[0])}—{dateLabel(data.model.ci95[1])}</strong></div>
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
            <div><div className="card-kicker">Combined daily forecasts</div><h2 id="distribution-title">Relative probability by date</h2></div>
            <div className="chart-legends"><span><i className="model-key" />TurkeySci probability</span><span><i className="usgs-key" />Latest USGS window</span></div>
          </div>
          <p className="figure-intro">Every date is shown in order. Taller orange bars mean greater relative support from the TurkeySci model.</p>
          <div className="distribution-scroll">
            <div className="chart" style={{ minWidth: `${Math.max(620, visibleDistribution.length * 78)}px` }} role="img" aria-label={`Daily probability distribution peaking on ${longDate(data.model.mapDate)}; current USGS window appears behind the TurkeySci bars`}>
              {usgsWindow && (() => {
                const start = visibleDistribution.findIndex((point) => point.date === usgsWindow.start);
                const end = visibleDistribution.findIndex((point) => point.date === usgsWindow.end);
                if (start < 0 || end < 0) return null;
                return <span className="usgs-band" style={{ left: `${(start / visibleDistribution.length) * 100}%`, width: `${((end - start + 1) / visibleDistribution.length) * 100}%` }}><b>USGS window</b></span>;
              })()}
              {visibleDistribution.map((point) => {
                const isPeak = point.date === data.model?.mapDate;
                const showValue = point.probability >= .001 || isPeak;
                return <div className={`bar-column ${isPeak ? "peak" : ""}`} key={point.date}>
                  <span className="bar-value">{showValue ? probabilityLabel(point.probability) : ""}</span>
                  <div className="bar-track"><div className="bar" style={{ height: `${Math.max((point.probability / peak) * 100, .35)}%` }} /></div>
                  <time className="bar-date" dateTime={point.date}>{dateLabel(point.date)}</time>
                  {isPeak && <span className="prediction-marker">TurkeySci peak</span>}
                </div>;
              })}
            </div>
          </div>
          <p className="chart-note">The green band is the latest official USGS range. The orange TurkeySci result stays on top so both can be compared directly.</p>
        </article>}

        <article className="history-card" id="evolution">
          <div className="history-heading"><div><div className="card-kicker">Episode {data.currentEpisode} inputs</div><h2>How the USGS forecast changed each day</h2></div><span>{chronologicalForecasts.length} daily windows</span></div>
          <p className="figure-intro">Dates across the top are possible eruption dates. Each row is one USGS update; the highlighted row is today’s update, or the latest available update if today’s report has not been published.</p>
          <ForecastEvolution forecasts={chronologicalForecasts} episode={data.currentEpisode} referenceDate={referenceDate} />
        </article>

        <article className="eruption-card" id="history">
          <div className="history-heading"><div><div className="card-kicker">Observed history</div><h2>Recent eruption timeline</h2></div><span>USGS episode dates</span></div>
          <p className="figure-intro">The ten most recent completed episodes are shown in sequence. The number between markers is the time from one episode start to the next.</p>
          <EruptionTimeline eruptions={data.previousEruptions} />
        </article>
      </section>

      <section className="method-section" id="method">
        <div className="section-label">02 · What the model actually does</div>
        <div className="method-intro"><h2>Every forecast matters.</h2><p>TurkeySci uses the complete sequence of daily USGS windows for the active episode—not just the latest range and not simply its midpoint.</p></div>
        <div className="equation-card"><span>Probability by date</span><strong>∝</strong><span>starting assumption</span><strong>×</strong><span>weighted daily forecasts</span></div>
        <div className="steps">
          <article><span>1</span><h3>Collect</h3><p>Retrieve every daily forecast window for the active episode from the official USGS HANS archive.</p></article>
          <article><span>2</span><h3>Translate</h3><p>Turn each published window into a smooth range of possible eruption dates.</p></article>
          <article><span>3</span><h3>Weight</h3><p>Give newer and narrower forecasts more influence using the original model settings.</p></article>
          <article><span>4</span><h3>Combine</h3><p>Combine all daily evidence and rescale it into an easy-to-compare probability curve.</p></article>
        </div>
        <div className="method-detail"><span>Technical settings</span><code>σ scale 2.0 · recency 2.0 · narrowness 1.5 · ±7 day grid</code></div>
      </section>

      <section className="about-section" id="about">
        <div><div className="section-label">03 · About</div><h2>Independent science for a living volcano.</h2></div>
        <div className="about-copy">
          <p>TurkeySci is an independent research project by <strong>Endlessczz</strong>. It makes the evolution of public USGS forecasts easier to see and provides a reproducible Bayesian synthesis of those forecasts.</p>
          <p className="warning"><strong>Experimental model—not an official warning system.</strong> Never use TurkeySci for safety, evacuation, travel, or emergency decisions. Follow USGS, Hawaiʻi County Civil Defense, and Hawaiʻi Volcanoes National Park guidance.</p>
          <div className="about-links"><a className="usgs-link" href={data.usgs.sourceUrl} target="_blank" rel="noreferrer">Read the latest USGS update ↗</a></div>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="contact-label">Questions · Ideas · Collaboration</div>
        <div className="contact-copy">
          <div><span>Contact</span><h2>Let’s talk about volcano forecasting.</h2></div>
          <div className="contact-person"><strong>Endlessczz</strong><a href="mailto:endlessczz@gmail.com">endlessczz@gmail.com</a><p>Questions about TurkeySci, suggestions for the public portal, and research collaboration inquiries are welcome.</p></div>
        </div>
      </section>

      <footer><a href="#top"><Logo compact /></a><p>Bayesian eruption timing · Kīlauea, Hawaiʻi</p><p>By Endlessczz · USGS data {dateLabel(data.usgs.issuedDate, { month: "long", year: "numeric" })}</p></footer>
    </main>
  );
}
