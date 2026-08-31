export function lineChart(points, { width = 300, height = 100, color = "var(--accent)", padding = 10 } = {}) {
  if (!points.length) {
    return `<div class="chart-empty">Dati insufficienti</div>`;
  }
  if (points.length === 1) {
    return `<div class="chart-empty">Servono almeno due punti dati per il grafico</div>`;
  }
  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * w;
    const y = padding + h - ((p.value - min) / range) * h;
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const dots = coords.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}" />`).join("");
  return `
    <svg viewBox="0 0 ${width} ${height}" class="line-chart" preserveAspectRatio="none">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      ${dots}
    </svg>
  `;
}
