const DAY_MS = 86_400_000;

export const MODEL_PARAMETERS = Object.freeze({
  sigmaScale: 2,
  recencyStrength: 2,
  narrowStrength: 1.5,
  padDays: 7,
});

function toDay(value) {
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time)) throw new Error(`Invalid ISO date: ${value}`);
  return Math.round(time / DAY_MS);
}

function fromDay(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantileDate(grid, probabilities, threshold) {
  let cumulative = 0;
  for (let i = 0; i < grid.length; i += 1) {
    cumulative += probabilities[i];
    if (cumulative >= threshold) return fromDay(grid[i]);
  }
  return fromDay(grid.at(-1));
}

export function posteriorOneEpisode(forecasts, parameters = {}) {
  const config = { ...MODEL_PARAMETERS, ...parameters };
  const rows = forecasts
    .filter((row) => row.windowStart && row.windowEnd && row.issuedDate)
    .map((row) => {
      const start = toDay(row.windowStart);
      const end = Math.max(toDay(row.windowEnd), start);
      return {
        ...row,
        start,
        end,
        issued: toDay(row.issuedDate),
        widthDays: end - start + 1,
        midpoint: start + Math.floor((end - start) / 2),
      };
    })
    .sort((a, b) => a.issued - b.issued);

  if (!rows.length) return null;

  const minDay = Math.min(...rows.map((row) => row.start)) - config.padDays;
  const maxDay = Math.max(...rows.map((row) => row.end)) + config.padDays;
  const grid = Array.from({ length: maxDay - minDay + 1 }, (_, index) => minDay + index);
  const medianWidth = median(rows.map((row) => row.widthDays));

  const weightedRows = rows.map((row, index) => {
    const recencyWeight =
      1 + config.recencyStrength * (index / Math.max(rows.length - 1, 1));
    const narrownessWeight = Math.max(
      (medianWidth / row.widthDays) ** config.narrowStrength,
      0.25,
    );
    return {
      ...row,
      sigmaDays: Math.max(row.widthDays / config.sigmaScale, 0.75),
      combinedWeight: recencyWeight * narrownessWeight,
    };
  });

  const logPosterior = grid.map((day) => {
    let value = -Math.log(grid.length);
    for (const row of weightedRows) {
      const z = (day - row.midpoint) / row.sigmaDays;
      const logDensity =
        -0.5 * Math.log(2 * Math.PI) - Math.log(row.sigmaDays) - 0.5 * z * z;
      value += row.combinedWeight * logDensity;
    }
    return value;
  });

  const peak = Math.max(...logPosterior);
  const unscaled = logPosterior.map((value) => Math.exp(value - peak));
  const normalizer = unscaled.reduce((sum, value) => sum + value, 0);
  const probabilities = unscaled.map((value) => value / normalizer);
  const mapIndex = probabilities.indexOf(Math.max(...probabilities));
  const meanDay = grid.reduce(
    (sum, day, index) => sum + day * probabilities[index],
    0,
  );

  return {
    mapDate: fromDay(grid[mapIndex]),
    meanDate: fromDay(Math.round(meanDay)),
    ci50: [
      quantileDate(grid, probabilities, 0.25),
      quantileDate(grid, probabilities, 0.75),
    ],
    ci95: [
      quantileDate(grid, probabilities, 0.025),
      quantileDate(grid, probabilities, 0.975),
    ],
    observations: rows.length,
    parameters: config,
    distribution: grid.map((day, index) => ({
      date: fromDay(day),
      probability: Number(probabilities[index].toFixed(8)),
    })),
  };
}
