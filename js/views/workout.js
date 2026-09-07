import { getPlan, getLastExerciseSession, saveSession, getState, updateExerciseLoad, getSessionsForDay } from "../storage.js";
import { evaluateExercise, STATUS, STATUS_LABEL } from "../progression.js";
import { createRestTimer, formatMMSS } from "../timer.js";
import { LOAD_UNIT_LABELS } from "../data/planData.js";

const DRAFT_KEY = "workoutTrackerDraft";
const DRAFT_VERSION = 2;
const RIR_OPTIONS = [0, 1, 2, 3, 4];

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadStep(loadUnit, currentLoad, wasUnset) {
  if (loadUnit === "bodyweight") return 0;
  if (wasUnset) return 2.5;
  return (currentLoad || 0) >= 20 ? 1 : 0.5;
}

function fmtLoad(load, loadUnit) {
  if (load === null || load === undefined) return "Da impostare";
  const unit = LOAD_UNIT_LABELS[loadUnit] || "kg";
  return loadUnit === "bodyweight" ? "corpo libero" : `${load} ${unit}`;
}

function fmtSetsSummary(sets) {
  return sets.map(s => s.reps).join(" / ");
}

function initSets(def, prevSets) {
  const defaultRir = Math.round(def.targetRir);
  const list = [];
  for (let i = 0; i < def.sets; i++) {
    const p = prevSets && prevSets[i];
    list.push({
      load: p ? p.load : (def.currentLoad !== null ? def.currentLoad : (def.loadUnit === "bodyweight" ? 0 : 15)),
      reps: p ? p.reps : def.repRange[0],
      rir: p ? Math.round(p.rir) : defaultRir,
      done: false
    });
  }
  return list;
}

export function render(container, params) {
  const day = params && params.day;
  const plan = getPlan();
  const dayPlan = plan[day];

  if (!dayPlan) {
    container.innerHTML = `<div class="screen"><p>Giorno non valido.</p></div>`;
    return;
  }

  let draft = loadDraft();
  if (!draft || draft.version !== DRAFT_VERSION || draft.day !== day) {
    const date = todayISO();
    draft = {
      version: DRAFT_VERSION,
      day,
      date,
      startedAt: new Date().toISOString(),
      expanded: { 0: true },
      exercises: dayPlan.exercises.map(def => {
        const prev = getLastExerciseSession(def.name, date);
        return {
          exerciseName: def.name,
          completed: false,
          pain: null,
          evaluation: null,
          sets: initSets(def, prev ? prev.exercise.sets : null)
        };
      })
    };
    saveDraft(draft);
  }

  let restTimer = null;
  let finished = false;
  let finalSummary = null;

  function stopTimer() {
    if (restTimer) {
      restTimer.stop();
      restTimer = null;
    }
  }

  function persist() {
    saveDraft(draft);
  }

  function previousSessionFor(exerciseName) {
    return getLastExerciseSession(exerciseName, draft.date);
  }

  function paint() {
    stopTimer();
    if (finished) {
      paintSummary();
      return;
    }
    paintWorkout();
  }

  function suggestionBlock(prev) {
    if (!prev || !prev.exercise.evaluation) {
      return `<div class="suggestion-box suggestion-neutral">Prima volta che registri questo esercizio: esegui e valuta al termine.</div>`;
    }
    const ev = prev.exercise.evaluation;
    const label = STATUS_LABEL[ev.status];
    return `
      <div class="suggestion-box suggestion-${ev.status.toLowerCase()}">
        <div class="suggestion-title">${label.emoji} ${label.text.toUpperCase()}</div>
        <div class="suggestion-text">${ev.reason}</div>
      </div>
    `;
  }

  function resultBlock(entry) {
    const ev = entry.evaluation;
    const label = STATUS_LABEL[ev.status];
    return `
      <div class="suggestion-box suggestion-${ev.status.toLowerCase()}">
        <div class="suggestion-title">${label.emoji} ${label.text.toUpperCase()}</div>
        <div class="suggestion-text">${ev.reason}</div>
        <div class="suggestion-next">PROSSIMA VOLTA: ${fmtLoad(ev.nextLoad, dayPlan.exercises.find(d => d.name === entry.exerciseName).loadUnit)} · ${ev.nextRepGoalText} reps</div>
      </div>
    `;
  }

  function renderSetsList(def, entry) {
    return entry.sets.map((set, i) => {
      if (set.done) {
        return `
          <div class="set-row set-row-done" data-action="edit-set" data-set-index="${i}">
            <span class="set-index">Serie ${i + 1} ✓</span>
            <span class="set-summary">${fmtLoad(set.load, def.loadUnit)} × ${set.reps} reps · RIR ${set.rir}</span>
            <span class="set-edit-hint">✏️</span>
          </div>
        `;
      }
      const isActive = entry.sets.slice(0, i).every(s => s.done);
      if (!isActive) {
        return `<div class="set-row set-row-pending"><span class="set-index">Serie ${i + 1}</span></div>`;
      }
      const step = loadStep(def.loadUnit, set.load, def.currentLoad === null);
      return `
        <div class="set-row set-row-active" data-set-index="${i}">
          <div class="set-index">Serie ${i + 1}</div>
          ${def.loadUnit !== "bodyweight" ? `
          <div class="stepper" data-field="load" data-set="${i}">
            <button class="stepper-btn" data-action="dec-load" data-step="${step}">-</button>
            <span class="stepper-value">${set.load} ${LOAD_UNIT_LABELS[def.loadUnit] || "kg"}</span>
            <button class="stepper-btn" data-action="inc-load" data-step="${step}">+</button>
          </div>` : `<div class="stepper-static">corpo libero</div>`}
          <div class="stepper" data-field="reps" data-set="${i}">
            <button class="stepper-btn" data-action="dec-reps">-</button>
            <span class="stepper-value">${set.reps} reps</span>
            <button class="stepper-btn" data-action="inc-reps">+</button>
          </div>
          <div class="rir-picker" data-set="${i}">
            ${RIR_OPTIONS.map(v => `<button class="rir-btn ${set.rir === v ? "rir-selected" : ""}" data-action="set-rir" data-value="${v}">${v === 4 ? "4+" : v}</button>`).join("")}
          </div>
          <button class="confirm-set-btn" data-action="confirm-set">✓ SEGNA SERIE</button>
        </div>
      `;
    }).join("");
  }

  function renderExerciseCard(def, entry, index) {
    const isExpanded = !!draft.expanded[index];
    const prev = previousSessionFor(def.name);
    const allDone = entry.sets.every(s => s.done);
    const statusIcon = entry.completed
      ? STATUS_LABEL[entry.evaluation.status].emoji
      : (entry.sets.some(s => s.done) ? "🔵" : "⚪");
    const miniSummary = prev
      ? `${fmtLoad(prev.exercise.sets[0]?.load, def.loadUnit)} × ${fmtSetsSummary(prev.exercise.sets)}`
      : "Nessun dato precedente";

    const targetLoadToday = prev && prev.exercise.evaluation ? prev.exercise.evaluation.nextLoad : def.currentLoad;
    const targetRepsToday = prev && prev.exercise.evaluation ? prev.exercise.evaluation.nextRepGoalText : `${def.repRange[0]}–${def.repRange[1]}`;

    return `
      <div class="accordion-item ${entry.completed ? "accordion-item-done" : ""}" data-exercise-index="${index}">
        <button class="accordion-header" data-action="toggle-exercise" data-index="${index}">
          <span class="accordion-status">${statusIcon}</span>
          <span class="accordion-name">${def.name}</span>
          <span class="accordion-mini">${miniSummary}</span>
          <span class="accordion-chevron">${isExpanded ? "▲" : "▼"}</span>
        </button>
        ${isExpanded ? `
        <div class="accordion-body">
          ${def.specialNote ? `<div class="exercise-note">⚠ ${def.specialNote}</div>` : ""}

          <div class="card">
            <div class="card-label">Ultima sessione</div>
            <div class="card-value">${miniSummary}</div>
            ${prev ? `<div class="card-sub">RIR: ${prev.exercise.sets.map(s => s.rir).join("/")}</div>` : ""}
          </div>

          <div class="card">
            <div class="card-label">Obiettivo di oggi</div>
            <div class="card-value">${fmtLoad(targetLoadToday, def.loadUnit)}</div>
            <div class="card-sub">${targetRepsToday} reps · RIR ${def.targetRir}</div>
          </div>

          ${entry.completed ? resultBlock(entry) : suggestionBlock(prev)}

          <div class="rest-timer-slot" id="rest-timer-slot-${index}"></div>

          <div class="sets-list">${renderSetsList(def, entry)}</div>

          <div class="pain-toggle">
            <label class="pain-label">Dolore (opzionale): <span class="pain-value-${index}">${entry.pain ?? "-"}</span></label>
            <input type="range" min="0" max="10" step="1" class="pain-slider" data-index="${index}" value="${entry.pain ?? 0}" />
          </div>

          <button class="primary-btn" data-action="complete-exercise" data-index="${index}" ${allDone ? "" : "disabled"}>
            ${entry.completed ? "✓ RICALCOLA VALUTAZIONE" : "✓ COMPLETA ESERCIZIO"}
          </button>
        </div>` : ""}
      </div>
    `;
  }

  function paintWorkout() {
    const completedCount = draft.exercises.filter(e => e.completed).length;
    const total = dayPlan.exercises.length;

    const cardsHtml = dayPlan.exercises.map((def, i) => renderExerciseCard(def, draft.exercises[i], i)).join("");

    container.innerHTML = `
      <div class="screen workout-screen">
        <div class="workout-header">
          <button class="icon-btn" id="exit-workout">✕</button>
          <span class="workout-progress">${completedCount}/${total} completati</span>
          <span class="workout-day">Giorno ${day}</span>
        </div>

        <div class="accordion-list">${cardsHtml}</div>

        <button class="primary-btn" id="finish-workout" ${completedCount === 0 ? "disabled" : ""}>
          TERMINA ALLENAMENTO
        </button>
      </div>
    `;

    container.querySelector("#exit-workout").addEventListener("click", () => {
      if (confirm("Uscire dall'allenamento? Il progresso viene mantenuto per quando riprendi.")) {
        location.hash = "#/home";
      }
    });

    container.querySelectorAll("[data-action='toggle-exercise']").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = e.currentTarget.dataset.index;
        draft.expanded[idx] = !draft.expanded[idx];
        persist();
        paintWorkout();
      });
    });

    container.querySelectorAll(".accordion-body").forEach(body => {
      const index = Number(body.closest("[data-exercise-index]").dataset.exerciseIndex);
      const def = dayPlan.exercises[index];
      const entry = draft.exercises[index];

      body.querySelectorAll(".stepper-btn, .rir-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const setIndex = Number(e.target.closest("[data-set]").dataset.set);
          const action = e.target.dataset.action;
          const set = entry.sets[setIndex];
          if (action === "inc-load") set.load = Math.round((set.load + Number(e.target.dataset.step)) * 10) / 10;
          if (action === "dec-load") set.load = Math.max(0, Math.round((set.load - Number(e.target.dataset.step)) * 10) / 10);
          if (action === "inc-reps") set.reps += 1;
          if (action === "dec-reps") set.reps = Math.max(0, set.reps - 1);
          if (action === "set-rir") set.rir = Number(e.target.dataset.value);
          persist();
          paintWorkout();
        });
      });

      body.querySelectorAll("[data-action='confirm-set']").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const setIndex = Number(e.target.closest("[data-set-index]").dataset.setIndex);
          entry.sets[setIndex].done = true;
          persist();
          const isLastSet = setIndex === entry.sets.length - 1;
          paintWorkout();
          if (!isLastSet) startRestTimer(index, def.restSeconds);
        });
      });

      body.querySelectorAll("[data-action='edit-set']").forEach(row => {
        row.addEventListener("click", (e) => {
          const setIndex = Number(e.currentTarget.dataset.setIndex);
          entry.sets[setIndex].done = false;
          entry.completed = false;
          persist();
          paintWorkout();
        });
      });

      const painSlider = body.querySelector(".pain-slider");
      if (painSlider) {
        painSlider.addEventListener("input", (e) => {
          entry.pain = Number(e.target.value);
          const label = container.querySelector(`.pain-value-${index}`);
          if (label) label.textContent = entry.pain;
        });
        painSlider.addEventListener("change", persist);
      }

      const completeBtn = body.querySelector("[data-action='complete-exercise']");
      if (completeBtn) {
        completeBtn.addEventListener("click", () => onCompleteExercise(index));
      }
    });

    container.querySelector("#finish-workout").addEventListener("click", onFinishWorkout);
  }

  function startRestTimer(index, seconds) {
    const slot = container.querySelector(`#rest-timer-slot-${index}`);
    if (!slot) return;
    stopTimer();
    let remaining = seconds;
    function draw() {
      slot.innerHTML = `
        <div class="rest-timer-card">
          <div class="rest-timer-label">RECUPERO</div>
          <div class="rest-timer-clock">${formatMMSS(remaining)}</div>
          <div class="rest-timer-controls">
            <button class="rest-btn" id="rest-minus">-15s</button>
            <button class="rest-btn" id="rest-plus">+15s</button>
            <button class="rest-btn rest-skip" id="rest-skip">SALTA</button>
          </div>
        </div>
      `;
      slot.querySelector("#rest-minus").addEventListener("click", () => restTimer.addSeconds(-15));
      slot.querySelector("#rest-plus").addEventListener("click", () => restTimer.addSeconds(15));
      slot.querySelector("#rest-skip").addEventListener("click", () => {
        stopTimer();
        slot.innerHTML = "";
      });
    }
    restTimer = createRestTimer({
      seconds,
      onTick: (r) => { remaining = r; const clock = slot.querySelector(".rest-timer-clock"); if (clock) clock.textContent = formatMMSS(r); },
      onDone: () => { slot.innerHTML = ""; }
    });
    draw();
  }

  function onCompleteExercise(index) {
    stopTimer();
    const def = dayPlan.exercises[index];
    const entry = draft.exercises[index];
    const sets = entry.sets.map(s => ({ load: s.load, reps: s.reps, rir: s.rir, pain: entry.pain }));
    const prev = previousSessionFor(def.name);
    const previousExerciseSession = prev ? prev.exercise : null;
    const evaluation = evaluateExercise({
      def,
      sets,
      previousExerciseSession,
      settings: getState().settings
    });

    if (evaluation.nextLoad !== null && evaluation.nextLoad !== def.currentLoad) {
      updateExerciseLoad(day, def.name, evaluation.nextLoad);
    }

    entry.completed = true;
    entry.evaluation = evaluation;
    persist();
    paintWorkout();
  }

  function onFinishWorkout() {
    const incompleteCount = draft.exercises.filter(e => !e.completed).length;
    if (incompleteCount > 0 && !confirm(`${incompleteCount} esercizi non sono stati completati. Terminare comunque l'allenamento?`)) {
      return;
    }
    stopTimer();
    finalizeSession();
    finished = true;
    paint();
  }

  function finalizeSession() {
    const completedExercises = draft.exercises.filter(e => e.completed);
    const durationMin = Math.max(1, Math.round((Date.now() - new Date(draft.startedAt).getTime()) / 60000));
    const volume = completedExercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (typeof set.load === "number" ? set.load * set.reps : 0), 0), 0);

    const previousSameDay = getSessionsForDay(day)[0] || null;
    let volumeChangePercent = null;
    if (previousSameDay) {
      const prevVolume = previousSameDay.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (typeof set.load === "number" ? set.load * set.reps : 0), 0), 0);
      if (prevVolume > 0) volumeChangePercent = Math.round(((volume - prevVolume) / prevVolume) * 1000) / 10;
    }

    const increasedExercise = completedExercises.find(ex => ex.evaluation.status === STATUS.INCREASE);
    const bestResult = increasedExercise
      ? { name: increasedExercise.exerciseName, summary: `${fmtSetsSummary(increasedExercise.sets)} @ ${increasedExercise.sets[0].load}` }
      : null;

    const session = {
      id: `${draft.date}-${day}-${draft.startedAt}`,
      day,
      date: draft.date,
      durationMin,
      exercises: completedExercises.map(e => ({ exerciseName: e.exerciseName, sets: e.sets, evaluation: e.evaluation }))
    };
    saveSession(session);
    clearDraft();

    finalSummary = {
      durationMin,
      exerciseCount: completedExercises.length,
      volumeChangePercent,
      bestResult
    };
  }

  function paintSummary() {
    container.innerHTML = `
      <div class="screen summary-screen">
        <h2 class="summary-title">ALLENAMENTO COMPLETATO ✓</h2>
        <div class="card">
          <div class="card-label">Durata</div>
          <div class="card-value">${finalSummary.durationMin} min</div>
        </div>
        <div class="card">
          <div class="card-label">Esercizi</div>
          <div class="card-value">${finalSummary.exerciseCount}</div>
        </div>
        ${finalSummary.volumeChangePercent !== null ? `
        <div class="card">
          <div class="card-label">Volume</div>
          <div class="card-value">${finalSummary.volumeChangePercent > 0 ? "+" : ""}${finalSummary.volumeChangePercent}% rispetto all'ultima volta</div>
        </div>` : ""}
        ${finalSummary.bestResult ? `
        <div class="card card-highlight">
          <div class="card-label">Miglior risultato</div>
          <div class="card-value">${finalSummary.bestResult.name}</div>
          <div class="card-sub">${finalSummary.bestResult.summary}</div>
        </div>` : ""}
        <button class="primary-btn" id="back-home">TORNA ALLA HOME</button>
      </div>
    `;
    container.querySelector("#back-home").addEventListener("click", () => { location.hash = "#/home"; });
  }

  paint();
}
