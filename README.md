# TurkeySci

TurkeySci is an experimental public portal for estimating the timing of Kīlauea's next lava-fountaining episode. It automatically reads official forecast windows from the USGS Hawaiian Volcano Observatory and applies the project's original Bayesian model.

> **Not an official warning system.** TurkeySci is an independent research project. Do not use it for safety, evacuation, travel, or emergency decisions. Follow USGS, Hawaiʻi County Civil Defense, and Hawaiʻi Volcanoes National Park guidance.

## What is automated

Every day at 11:30 a.m. HST, the GitHub Actions workflow:

1. Downloads the latest [USGS Kīlauea daily update](https://www.usgs.gov/volcanoes/kilauea/volcano-updates).
2. Reads the official [timeline of eruptive episodes](https://www.usgs.gov/volcanoes/kilauea/science/eruption-information).
3. Adds or updates the current forecast window without duplicating observations.
4. Runs the TurkeySci posterior model.
5. Tests the parser and model, then commits updated JSON data when the result changes.

The public portal also queries the official USGS HANS API directly when a visitor opens the site. This keeps the public forecast current without exposing or depending on a GitHub link. The committed JSON files remain reproducible snapshots and deployment fallbacks.

## Model

The JavaScript implementation in `scripts/lib/model.mjs` preserves the original R model's structure:

- Each USGS window becomes a Gaussian likelihood centered on the window midpoint.
- The standard deviation is derived from the window width.
- More recent forecasts receive greater weight.
- Narrower forecasts receive greater weight.
- The likelihoods are combined with a uniform prior and normalized over a daily grid.

Current fixed parameters match the original R defaults: `sigmaScale = 2`, `recencyStrength = 2`, `narrowStrength = 1.5`, and `padDays = 7`.

## Local development

Requires Node.js 22+ and pnpm.

```bash
pnpm install
pnpm data:update
pnpm dev
```

Run verification with:

```bash
pnpm test
```

## Data files

- `public/data/forecast-history.json` — migrated historical observations plus automatically captured forecasts.
- `public/data/current.json` — the latest official status and TurkeySci posterior shown by the portal.

USGS real-time information is preliminary and may be revised. The repository retains source URLs on each observation for traceability.

## License

MIT © Endlessczz
