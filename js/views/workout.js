import { getPlan, getExerciseDef, getLastExerciseSession, saveSession, getState, updateExerciseLoad, getSessionsForDay } from "../storage.js";
import { evaluateExercise, STATUS, STATUS_LABEL } from "../progression.js";
import { createRestTimer, formatMMSS } from "../timer.js";
import { LOAD_UNIT_LABELS } from "../data/planData.js";

const DRAFT_KEY = "workoutTrackerDraft";
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

export function render(container, params) {
  const day = params && params.day;
  const plan = getPlan();
  const dayPlan = plan[day];

  if (!dayPlan) {
    container.innerHTML = `<div class="screen"><p>Giorno non valido.</p></div>`;
    return;
  }

  let draft = loadDraft();
  if (!draft || draft.day !== day) {
    draft = {
      day,
      date: todayISO(),
      startedAt: new Date().toISOString(),
      exercises: [],
      currentExerciseIndex: 0
    };
    saveDraft(draft);
  }

  let activeSetInputs = null;
  let restTimer = null;
  let finished = false;

  function currentExerciseDef() {
    return dayPlan.exercises[draft.currentExerciseIndex];
  }

  function initSetInputsForExercise(def) {
    const prev = getLastExerciseSession(def.name, draft.date);
    const prevSets = prev ? prev.exercise.sets : [];
    const defaultRir = Math.round(def.targetRir);
    const wasUnset = def.currentLoad === null;
    const inputs = [];
    for (let i = 0; i < def.sets; i++) {
      const p = prevSets[i];
      inputs.push({
        load: p ? p.load : (def.currentLoad !== null ? def.currentLoad : (def.loadUnit === "bodyweight" ? 0 : 15)),
        reps: p ? p.reps : def.repRange[0],
        rir: p ? Math.round(p.rir) : defaultRir,
        done: false
      });
    }
    return { inputs, prev, pain: null, wasUnset };
  }

  function stopTimer() {
    if (restTimer) {
      restTimer.stop();
      restTimer = null;
    }
  }

  function paint() {
    stopTimer();
    if (finished) {
      paintSummary();
      return;
    }
    const def = currentExerciseDef();
    if (!activeSetInputs) activeSetInputs = initSetInputsForExercise(def);
    paintExercise(def);
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

  function paintExercise(def) {
    const { inputs, prev } = activeSetInputs;
    const total = dayPlan.exercises.length;
    const idx = draft.currentExerciseIndex;
    const targetLoadToday = prev && prev.exercise.evaluation ? prev.exercise.evaluation.nextLoad : def.currentLoad;
    const targetRepsToday = prev && prev.exercise.evaluation ? prev.exercise.evaluation.nextRepGoalText : `${def.repRange[0]}–${def.repRange[1]}`;

    const setsHtml = inputs.map((set, i) => {
      if (set.done) {
        return `
          <div class="set-row set-row-done">
            <span class="set-index">Serie ${i + 1} ✓</span>
            <span class="set-summary">${fmtLoad(set.load, def.loadUnit)} × ${set.reps} reps · RIR ${set.rir}</span>
          </div>
        `;
      }
      const isActive = inputs.slice(0, i).every(s => s.done);
      if (!isActive) {
        return `<div class="set-row set-row-pending"><span class="set-index">Serie ${i + 1}</span></div>`;
      }
      const step = loadStep(def.loadUnit, set.load, activeSetInputs.wasUnset);
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

    const allDone = inputs.every(s => s.done);

    container.innerHTML = `
      <div class="screen workout-screen">
        <div class="workout-header">
          <button class="icon-btn" id="exit-workout">✕</button>
          <span class="workout-progress">Esercizio ${idx + 1}/${total}</span>
          <span class="workout-day">Giorno ${day}</span>
        </div>

        <h2 class="exercise-name">${def.name}${def.specialNote ? `<span class="exercise-note">⚠ ${def.specialNote}</span>` : ""}</h2>

        <div class="card">
          <div class="card-label">Ultima sessione</div>
          <div class="card-value">${prev ? `${fmtLoad(prev.exercise.sets[0]?.load, def.loadUnit)} × ${fmtSetsSummary(prev.exercise.sets)}` : "Nessun dato precedente"}</div>
          ${prev ? `<div class="card-sub">RIR: ${prev.exercise.sets.map(s => s.rir).join("/")}</div>` : ""}
        </div>

        <div class="card">
          <div class="card-label">Obiettivo di oggi</div>
          <div class="card-value">${fmtLoad(targetLoadToday, def.loadUnit)}</div>
          <div class="card-sub">${targetRepsToday} reps · RIR ${def.targetRir}</div>
        </div>

        ${suggestionBlock(prev)}

        <div class="rest-timer-slot" id="rest-timer-slot"></div>

        <div class="sets-list">${setsHtml}</div>

        <div class="pain-toggle">
          <label class="pain-label">Dolore (opzionale): <span id="pain-value">${activeSetInputs.pain ?? "-"}</span></label>
          <input type="range" min="0" max="10" step="1" id="pain-slider" value="${activeSetInputs.pain ?? 0}" />
        </div>

        <button class="primary-btn" id="finish-exercise" ${allDone ? "" : "disabled"}>
          ${idx === total - 1 ? "FINE ALLENAMENTO" : "ESERCIZIO COMPLETATO →"}
        </button>
      </div>
    `;

    container.querySelector("#exit-workout").addEventListener("click", () => {
      if (confirm("Uscire dall'allenamento? Il progresso di questo esercizio verrà mantenuto per quando riprendi.")) {
        location.hash = "#/home";
      }
    });

    container.querySelectorAll(".stepper-btn, .rir-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const setIndex = Number(e.target.closest("[data-set]").dataset.set);
        const action = e.target.dataset.action;
        const set = inputs[setIndex];
        if (action === "inc-load") set.load = Math.round((set.load + Number(e.target.dataset.step)) * 10) / 10;
        if (action === "dec-load") set.load = Math.max(0, Math.round((set.load - Number(e.target.dataset.step)) * 10) / 10);
        if (action === "inc-reps") set.reps += 1;
        if (action === "dec-reps") set.reps = Math.max(0, set.reps - 1);
        if (action === "set-rir") set.rir = Number(e.target.dataset.value);
        paintExercise(def);
      });
    });

    container.querySelectorAll("[data-action='confirm-set']").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const setIndex = Number(e.target.closest("[data-set-index]").dataset.setIndex);
        inputs[setIndex].done = true;
        persistProgress();
        const isLastSet = setIndex === inputs.length - 1;
        paintExercise(def);
        if (!isLastSet) startRestTimer(def.restSeconds);
      });
    });

    const painSlider = container.querySelector("#pain-slider");
    painSlider.addEventListener("input", (e) => {
      activeSetInputs.pain = Number(e.target.value);
      container.querySelector("#pain-value").textContent = activeSetInputs.pain;
    });

    container.querySelector("#finish-exercise").addEventListener("click", onFinishExercise);
  }

  function startRestTimer(seconds) {
    const slot = container.querySelector("#rest-timer-slot");
    if (!slot) return;
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

  function persistProgress() {
    saveDraft(draft);
  }

  function onFinishExercise() {
    stopTimer();
    const def = currentExerciseDef();
    const sets = activeSetInputs.inputs.map(s => ({ load: s.load, reps: s.reps, rir: s.rir, pain: activeSetInputs.pain }));
    const previousExerciseSession = activeSetInputs.prev ? activeSetInputs.prev.exercise : null;
    const evaluation = evaluateExercise({
      def,
      sets,
      previousExerciseSession,
      settings: getState().settings
    });

    if (evaluation.nextLoad !== null && evaluation.nextLoad !== def.currentLoad) {
      updateExerciseLoad(day, def.name, evaluation.nextLoad);
    }

    draft.exercises.push({ exerciseName: def.name, sets, evaluation });

    const isLast = draft.currentExerciseIndex === dayPlan.exercises.length - 1;
    if (isLast) {
      finalizeSession();
      finished = true;
      activeSetInputs = null;
      paint();
      return;
    }

    draft.currentExerciseIndex += 1;
    persistProgress();
    activeSetInputs = null;
    paint();
  }

  let finalSummary = null;

  function finalizeSession() {
    const durationMin = Math.max(1, Math.round((Date.now() - new Date(draft.startedAt).getTime()) / 60000));
    const volume = draft.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (typeof set.load === "number" ? set.load * set.reps : 0), 0), 0);

    const previousSameDay = getSessionsForDay(day)[0] || null;
    let volumeChangePercent = null;
    if (previousSameDay) {
      const prevVolume = previousSameDay.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (typeof set.load === "number" ? set.load * set.reps : 0), 0), 0);
      if (prevVolume > 0) volumeChangePercent = Math.round(((volume - prevVolume) / prevVolume) * 1000) / 10;
    }

    const increasedExercise = draft.exercises.find(ex => ex.evaluation.status === STATUS.INCREASE);
    const bestResult = increasedExercise
      ? { name: increasedExercise.exerciseName, summary: `${fmtSetsSummary(increasedExercise.sets)} @ ${increasedExercise.sets[0].load}` }
      : null;

    const session = {
      id: `${draft.date}-${day}-${draft.startedAt}`,
      day,
      date: draft.date,
      durationMin,
      exercises: draft.exercises
    };
    saveSession(session);
    clearDraft();

    finalSummary = {
      durationMin,
      exerciseCount: draft.exercises.length,
      volumeChangePercent,
      bestResult,
      nextTime: increasedExercise ? increasedExercise.evaluation : null
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
