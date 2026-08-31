import { getAllExerciseNames, getSessionsForExercise } from "../storage.js";
import { lineChart } from "../charts.js";

function volumeOf(exerciseSession) {
  return exerciseSession.sets.reduce((sum, s) => sum + (typeof s.load === "number" ? s.load * s.reps : 0), 0);
}

function computePRs(entries) {
  if (!entries.length) return null;
  let maxLoad = null;
  let maxVolume = null;
  let maxRepsAtLoad = null;
  entries.forEach(e => {
    const ex = e.exercise;
    const vol = volumeOf(ex);
    ex.sets.forEach(s => {
      if (typeof s.load === "number" && (maxLoad === null || s.load > maxLoad.load)) {
        maxLoad = { load: s.load, date: e.date };
      }
      if (typeof s.load === "number" && (maxRepsAtLoad === null || (s.load === maxRepsAtLoad.load && s.reps > maxRepsAtLoad.reps) || s.load > maxRepsAtLoad.load)) {
        if (maxRepsAtLoad === null || s.reps > maxRepsAtLoad.reps) {
          maxRepsAtLoad = { load: s.load, reps: s.reps, date: e.date };
        }
      }
    });
    if (maxVolume === null || vol > maxVolume.volume) {
      maxVolume = { volume: vol, date: e.date };
    }
  });
  return { maxLoad, maxVolume, maxRepsAtLoad };
}

export function render(container) {
  const names = getAllExerciseNames();

  function paint(selectedName) {
    const entries = selectedName ? getSessionsForExercise(selectedName) : [];
    const chartPoints = entries
      .filter(e => e.exercise.sets[0] && typeof e.exercise.sets[0].load === "number")
      .map(e => ({ label: e.date, value: e.exercise.sets[0].load }));
    const prs = computePRs(entries);

    const rowsHtml = entries.length
      ? entries.slice().reverse().map(e => `
          <div class="history-row">
            <div class="history-row-date">${e.date} <span class="history-row-day">Giorno ${e.day}</span></div>
            <div class="history-row-detail">${e.exercise.sets.map(s => `${s.load}${typeof s.load === "number" ? "kg" : ""}×${s.reps}`).join(" / ")}</div>
            <div class="history-row-sub">RIR ${e.exercise.sets.map(s => s.rir).join("/")} · Volume ${volumeOf(e.exercise).toFixed(0)}</div>
          </div>
        `).join("")
      : `<div class="chart-empty">Nessuna sessione registrata per questo esercizio.</div>`;

    container.innerHTML = `
      <div class="screen history-screen">
        <h1 class="app-title">Storico</h1>
        <select id="exercise-select" class="exercise-select">
          <option value="">Seleziona esercizio…</option>
          ${names.map(n => `<option value="${n}" ${n === selectedName ? "selected" : ""}>${n}</option>`).join("")}
        </select>

        ${selectedName ? `
          <div class="card">
            <div class="card-label">Andamento carico</div>
            ${lineChart(chartPoints)}
          </div>

          ${prs ? `
          <div class="card card-highlight">
            <div class="card-label">Record personali</div>
            ${prs.maxLoad ? `<div class="card-sub">Carico massimo: ${prs.maxLoad.load}kg (${prs.maxLoad.date})</div>` : ""}
            ${prs.maxRepsAtLoad ? `<div class="card-sub">Miglior serie: ${prs.maxRepsAtLoad.reps} reps @ ${prs.maxRepsAtLoad.load}kg (${prs.maxRepsAtLoad.date})</div>` : ""}
            ${prs.maxVolume ? `<div class="card-sub">Miglior volume: ${prs.maxVolume.volume.toFixed(0)} (${prs.maxVolume.date})</div>` : ""}
          </div>` : ""}

          <div class="history-list">${rowsHtml}</div>
        ` : `<div class="chart-empty">Seleziona un esercizio per vedere lo storico.</div>`}
      </div>
    `;

    container.querySelector("#exercise-select").addEventListener("change", (e) => paint(e.target.value));
  }

  paint(names[0] || "");
}
