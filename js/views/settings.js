import { getPlan, updatePlanExercise, exportJSON, exportSessionsCSV, importJSON, resetAllData, exportPlanJSON, parsePlanJSON, diffPlan, applyPlan } from "../storage.js";
import { LOAD_UNIT_LABELS } from "../data/planData.js";

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function render(container) {
  function paint() {
    const plan = getPlan();
    const daysHtml = Object.entries(plan).map(([day, dayPlan]) => `
      <details class="day-editor">
        <summary>Giorno ${day} — ${dayPlan.focus.join(", ")}</summary>
        ${dayPlan.exercises.map(ex => `
          <div class="exercise-editor" data-day="${day}" data-exercise="${ex.name}">
            <div class="exercise-editor-name">${ex.name}</div>
            <label>Serie <input type="number" min="1" step="1" data-field="sets" value="${ex.sets}" /></label>
            <label>Rep min <input type="number" min="1" step="1" data-field="repMin" value="${ex.repRange[0]}" /></label>
            <label>Rep max <input type="number" min="1" step="1" data-field="repMax" value="${ex.repRange[1]}" /></label>
            <label>RIR target <input type="number" min="0" max="5" step="0.5" data-field="targetRir" value="${ex.targetRir}" /></label>
            <label>Recupero (s) <input type="number" min="15" step="5" data-field="restSeconds" value="${ex.restSeconds}" /></label>
            <label>Carico attuale (${LOAD_UNIT_LABELS[ex.loadUnit] || "kg"}) <input type="number" step="0.5" data-field="currentLoad" value="${ex.currentLoad ?? ""}" placeholder="Da impostare" /></label>
          </div>
        `).join("")}
      </details>
    `).join("");

    container.innerHTML = `
      <div class="screen settings-screen">
        <h1 class="app-title">Impostazioni</h1>

        <div class="card">
          <div class="card-label">Scheda di allenamento</div>
          <div class="plan-editor">${daysHtml}</div>
          <button class="primary-btn" id="save-plan">SALVA MODIFICHE SCHEDA</button>
        </div>

        <div class="card">
          <div class="card-label">Cambia scheda da file JSON</div>
          <div class="card-sub">Sostituisce solo la scheda dei giorni presenti nel file. Storico e misurazioni restano intatti.</div>
          <label class="secondary-btn file-label">IMPORTA SCHEDA (JSON)
            <input type="file" id="import-plan-file" accept="application/json,.json" hidden />
          </label>
          <button class="secondary-btn" id="export-plan">ESPORTA SCHEDA ATTUALE (MODELLO)</button>
        </div>

        <div class="card">
          <div class="card-label">Backup ed export</div>
          <button class="secondary-btn" id="export-json">EXPORT JSON</button>
          <button class="secondary-btn" id="export-csv">EXPORT CSV ALLENAMENTI</button>
          <label class="secondary-btn file-label">IMPORT JSON
            <input type="file" id="import-file" accept="application/json" hidden />
          </label>
        </div>

        <div class="card">
          <div class="card-label">Zona pericolosa</div>
          <button class="danger-btn" id="reset-data">CANCELLA TUTTI I DATI</button>
        </div>
      </div>
    `;

    container.querySelector("#save-plan").addEventListener("click", () => {
      container.querySelectorAll(".exercise-editor").forEach(el => {
        const day = el.dataset.day;
        const name = el.dataset.exercise;
        const get = (field) => el.querySelector(`[data-field="${field}"]`).value;
        const repMin = Number(get("repMin"));
        const repMax = Number(get("repMax"));
        const loadVal = get("currentLoad");
        updatePlanExercise(day, name, {
          sets: Number(get("sets")),
          repRange: [repMin, repMax],
          targetRir: Number(get("targetRir")),
          restSeconds: Number(get("restSeconds")),
          currentLoad: loadVal === "" ? null : Number(loadVal)
        });
      });
      alert("Scheda aggiornata.");
      paint();
    });

    container.querySelector("#export-plan").addEventListener("click", () => {
      downloadFile("scheda-attuale.json", exportPlanJSON(), "application/json");
    });
    container.querySelector("#import-plan-file").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let newDays;
        try {
          newDays = parsePlanJSON(reader.result);
        } catch (err) {
          alert("Scheda non importata.\n\n" + err.message);
          return;
        }
        const lines = diffPlan(newDays).map(d => {
          let line = `Giorno ${d.day}: ${d.count} esercizi`;
          if (d.added.length) line += `\n  + nuovi: ${d.added.join(", ")}`;
          if (d.removed.length) line += `\n  - rimossi: ${d.removed.join(", ")}`;
          return line;
        });
        const msg = `Sostituire la scheda?\n\n${lines.join("\n")}\n\nStorico e misurazioni restano. Un eventuale allenamento in corso non terminato verrà scartato.`;
        if (!confirm(msg)) return;
        applyPlan(newDays);
        alert("Scheda aggiornata.");
        paint();
      };
      reader.readAsText(file);
    });

    container.querySelector("#export-json").addEventListener("click", () => {
      downloadFile(`workout-tracker-backup-${Date.now()}.json`, exportJSON(), "application/json");
    });
    container.querySelector("#export-csv").addEventListener("click", () => {
      downloadFile(`workout-tracker-sessions-${Date.now()}.csv`, exportSessionsCSV(), "text/csv");
    });
    container.querySelector("#import-file").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importJSON(reader.result);
          alert("Dati importati correttamente.");
          paint();
        } catch (err) {
          alert("File non valido: " + err.message);
        }
      };
      reader.readAsText(file);
    });
    container.querySelector("#reset-data").addEventListener("click", () => {
      if (confirm("Cancellare TUTTI i dati salvati (allenamenti, storico, misurazioni, scheda)? Questa azione non è reversibile.")) {
        resetAllData();
        paint();
      }
    });
  }

  paint();
}
