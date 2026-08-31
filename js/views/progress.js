import { getMeasurements, saveMeasurement, getSessions } from "../storage.js";
import { lineChart } from "../charts.js";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function volumeInRange(fromDate, toDate) {
  return getSessions()
    .filter(s => s.date > fromDate && s.date <= toDate)
    .reduce((sum, s) => sum + s.exercises.reduce((es, ex) => es + ex.sets.reduce((ss, set) => ss + (typeof set.load === "number" ? set.load * set.reps : 0), 0), 0), 0);
}

function trendIndicator(measurements) {
  if (measurements.length < 2) return null;
  const last = measurements[measurements.length - 1];
  const prev = measurements[measurements.length - 2];
  const weightDelta = last.weight != null && prev.weight != null ? last.weight - prev.weight : null;
  const waistDelta = last.waist != null && prev.waist != null ? last.waist - prev.waist : null;
  const volPrev = volumeInRange(measurements.length > 2 ? measurements[measurements.length - 3].date : "0000-00-00", prev.date);
  const volLast = volumeInRange(prev.date, last.date);
  let volumeTrend = null;
  if (volPrev > 0) volumeTrend = volLast >= volPrev ? "up" : "down";

  return { weightDelta, waistDelta, volumeTrend };
}

export function render(container) {
  function paint() {
    const measurements = getMeasurements();
    const trend = trendIndicator(measurements);

    const weightPoints = measurements.filter(m => m.weight != null).map(m => ({ label: m.date, value: m.weight }));
    const waistPoints = measurements.filter(m => m.waist != null).map(m => ({ label: m.date, value: m.waist }));

    container.innerHTML = `
      <div class="screen progress-screen">
        <h1 class="app-title">Progressi</h1>

        ${trend ? `
        <div class="card card-highlight">
          <div class="card-label">Indicatore ricomposizione corporea</div>
          <div class="card-sub">Peso: ${trend.weightDelta === null ? "n/d" : trend.weightDelta === 0 ? "stabile" : `${trend.weightDelta > 0 ? "+" : ""}${trend.weightDelta.toFixed(1)} kg`}</div>
          <div class="card-sub">Vita: ${trend.waistDelta === null ? "n/d" : trend.waistDelta === 0 ? "stabile" : `${trend.waistDelta > 0 ? "+" : ""}${trend.waistDelta.toFixed(1)} cm`}</div>
          <div class="card-sub">Performance (volume allenante): ${trend.volumeTrend === null ? "n/d" : trend.volumeTrend === "up" ? "↑" : "↓"}</div>
        </div>` : `<div class="chart-empty">Servono almeno 2 misurazioni per calcolare un trend.</div>`}

        <div class="card">
          <div class="card-label">Peso</div>
          ${lineChart(weightPoints)}
        </div>
        <div class="card">
          <div class="card-label">Vita</div>
          ${lineChart(waistPoints)}
        </div>

        <div class="card">
          <div class="card-label">Nuova misurazione</div>
          <form id="measurement-form" class="measurement-form">
            <label>Data <input type="date" name="date" value="${todayISO()}" required /></label>
            <label>Peso (kg) <input type="number" step="0.1" name="weight" /></label>
            <label>Vita (cm) <input type="number" step="0.5" name="waist" /></label>
            <label>Passi medi/giorno <input type="number" step="100" name="steps" /></label>
            <label>Allenamenti questa settimana <input type="number" step="1" name="workouts" /></label>
            <label>Ore di sonno <input type="number" step="0.5" name="sleep" /></label>
            <label>Energia percepita (1-5) <input type="number" min="1" max="5" step="1" name="energy" /></label>
            <button type="submit" class="primary-btn">SALVA MISURAZIONE</button>
          </form>
        </div>

        <div class="history-list">
          ${measurements.slice().reverse().map(m => `
            <div class="history-row">
              <div class="history-row-date">${m.date}</div>
              <div class="history-row-detail">${m.weight != null ? `${m.weight}kg` : "-"} · Vita ${m.waist != null ? `${m.waist}cm` : "-"}</div>
              <div class="history-row-sub">Passi ${m.steps ?? "-"} · Allenamenti ${m.workouts ?? "-"} · Sonno ${m.sleep ?? "-"}h · Energia ${m.energy ?? "-"}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    container.querySelector("#measurement-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const toNum = (v) => (v === "" || v === null ? null : Number(v));
      saveMeasurement({
        date: fd.get("date"),
        weight: toNum(fd.get("weight")),
        waist: toNum(fd.get("waist")),
        steps: toNum(fd.get("steps")),
        workouts: toNum(fd.get("workouts")),
        sleep: toNum(fd.get("sleep")),
        energy: toNum(fd.get("energy"))
      });
      paint();
    });
  }

  paint();
}
