import { DEFAULT_PLAN } from "./data/planData.js";

const STORAGE_KEY = "workoutTrackerData";
const SCHEMA_VERSION = 1;

function emptyState() {
  return {
    version: SCHEMA_VERSION,
    plan: JSON.parse(JSON.stringify(DEFAULT_PLAN)),
    sessions: [],
    measurements: [],
    settings: {
      restIncrementSeconds: 15,
      loadIncrementPercent: 3.5
    }
  };
}

let state = null;

function load() {
  if (state) return state;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state = emptyState();
    persist();
    return state;
  }
  try {
    const parsed = JSON.parse(raw);
    state = Object.assign(emptyState(), parsed);
    if (!state.plan) state.plan = JSON.parse(JSON.stringify(DEFAULT_PLAN));
  } catch (e) {
    console.error("Impossibile leggere i dati salvati, inizializzo stato vuoto.", e);
    state = emptyState();
  }
  return state;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getState() {
  return load();
}

export function getPlan() {
  return load().plan;
}

export function getExerciseDef(day, exerciseName) {
  const dayPlan = load().plan[day];
  if (!dayPlan) return null;
  return dayPlan.exercises.find(e => e.name === exerciseName) || null;
}

export function updateExerciseLoad(day, exerciseName, newLoad) {
  const def = getExerciseDef(day, exerciseName);
  if (!def) return;
  def.currentLoad = newLoad;
  persist();
}

export function updatePlanExercise(day, exerciseName, patch) {
  const def = getExerciseDef(day, exerciseName);
  if (!def) return;
  Object.assign(def, patch);
  persist();
}

export function saveSession(session) {
  const s = load();
  s.sessions.push(session);
  persist();
  return session;
}

export function getSessions() {
  return load().sessions;
}

export function getSessionsForDay(day) {
  return load().sessions.filter(s => s.day === day).sort((a, b) => b.date.localeCompare(a.date));
}

export function getLastSession() {
  const sessions = load().sessions;
  if (!sessions.length) return null;
  return sessions.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function getSessionsForExercise(exerciseName) {
  return load().sessions
    .filter(s => s.exercises.some(e => e.exerciseName === exerciseName))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      date: s.date,
      day: s.day,
      exercise: s.exercises.find(e => e.exerciseName === exerciseName)
    }));
}

export function getLastExerciseSession(exerciseName, beforeDate) {
  const all = getSessionsForExercise(exerciseName).filter(x => !beforeDate || x.date < beforeDate);
  if (!all.length) return null;
  return all[all.length - 1];
}

export function saveMeasurement(entry) {
  const s = load();
  s.measurements.push(entry);
  s.measurements.sort((a, b) => a.date.localeCompare(b.date));
  persist();
  return entry;
}

export function getMeasurements() {
  return load().measurements;
}

export function getAllExerciseNames() {
  const plan = getPlan();
  const names = new Set();
  Object.values(plan).forEach(day => day.exercises.forEach(e => names.add(e.name)));
  return Array.from(names);
}

export function exportJSON() {
  return JSON.stringify(load(), null, 2);
}

export function exportSessionsCSV() {
  const rows = [["date", "day", "exercise", "setIndex", "load", "reps", "rir", "pain"]];
  load().sessions.forEach(s => {
    s.exercises.forEach(ex => {
      ex.sets.forEach((set, i) => {
        rows.push([s.date, s.day, ex.exerciseName, i + 1, set.load, set.reps, set.rir, set.pain ?? ""]);
      });
    });
  });
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

const PLAN_DAYS = ["A", "B", "C"];
const PLAN_LOAD_UNITS = ["kg", "kg_per_hand", "bodyweight"];

export function exportPlanJSON() {
  const days = {};
  Object.entries(load().plan).forEach(([day, dayPlan]) => {
    days[day] = {
      focus: dayPlan.focus,
      exercises: dayPlan.exercises.map(e => {
        const out = {
          name: e.name,
          sets: e.sets,
          rep_range: e.repRange,
          target_rir: e.targetRir,
          rest_seconds: e.restSeconds,
          current_load: e.currentLoad,
          load_unit: e.loadUnit
        };
        if (e.priority) out.priority = e.priority;
        if (e.failureAllowed !== undefined) out.failure_allowed = e.failureAllowed;
        if (e.specialNote) out.special_note = e.specialNote;
        if (e.supersetGroup) out.superset_group = e.supersetGroup;
        return out;
      })
    };
  });
  return JSON.stringify({ training_plan: { days } }, null, 2);
}

// Valida il JSON di una scheda (formato "training_plan.days") e lo converte nel formato interno.
// Non modifica nulla: restituisce i giorni pronti per applyPlan.
export function parsePlanJSON(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("Il file non è un JSON valido.");
  }
  const days = (parsed && parsed.training_plan && parsed.training_plan.days) || (parsed && parsed.days) || null;
  if (!days || typeof days !== "object") throw new Error('Non trovo "training_plan" > "days" nel file.');
  const dayKeys = Object.keys(days);
  if (!dayKeys.length) throw new Error("Nessun giorno (A, B, C) trovato nel file.");
  const unknown = dayKeys.filter(k => !PLAN_DAYS.includes(k));
  if (unknown.length) throw new Error(`Giorni non supportati: ${unknown.join(", ")}. Sono ammessi solo A, B, C.`);

  const knownLoads = {};
  Object.values(load().plan).forEach(d => d.exercises.forEach(e => {
    if (e.currentLoad !== null && e.currentLoad !== undefined) knownLoads[e.name] = e.currentLoad;
  }));

  const result = {};
  dayKeys.forEach(day => {
    const src = days[day];
    if (!src || !Array.isArray(src.exercises) || !src.exercises.length) {
      throw new Error(`Giorno ${day}: manca la lista "exercises".`);
    }
    const names = new Set();
    const exercises = src.exercises.map((ex, i) => {
      const where = `Giorno ${day}, esercizio ${i + 1}`;
      if (!ex || typeof ex.name !== "string" || !ex.name.trim()) throw new Error(`${where}: manca "name".`);
      const name = ex.name.trim();
      if (names.has(name)) throw new Error(`Giorno ${day}: l'esercizio "${name}" è duplicato.`);
      names.add(name);

      const sets = Number(ex.sets);
      if (!Number.isInteger(sets) || sets < 1 || sets > 10) throw new Error(`${where} (${name}): "sets" deve essere un intero tra 1 e 10.`);

      const range = ex.rep_range;
      if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || range[0] < 1 || range[0] > range[1]) {
        throw new Error(`${where} (${name}): "rep_range" deve essere [min, max] con min <= max, es. [6, 9].`);
      }

      const rir = Number(ex.target_rir);
      if (ex.target_rir === null || ex.target_rir === undefined || !Number.isFinite(rir) || rir < 0 || rir > 5) {
        throw new Error(`${where} (${name}): "target_rir" deve essere un numero tra 0 e 5.`);
      }

      const rest = ex.rest_seconds === undefined ? 90 : Number(ex.rest_seconds);
      if (!Number.isFinite(rest) || rest < 10 || rest > 600) throw new Error(`${where} (${name}): "rest_seconds" deve essere tra 10 e 600.`);

      const loadUnit = ex.load_unit || "kg";
      if (!PLAN_LOAD_UNITS.includes(loadUnit)) throw new Error(`${where} (${name}): "load_unit" deve essere ${PLAN_LOAD_UNITS.join(", ")}.`);

      let currentLoad = null;
      if (ex.current_load !== null && ex.current_load !== undefined) {
        currentLoad = Number(ex.current_load);
        if (!Number.isFinite(currentLoad) || currentLoad < 0) throw new Error(`${where} (${name}): "current_load" non valido.`);
      } else if (loadUnit !== "bodyweight" && knownLoads[name] !== undefined) {
        currentLoad = knownLoads[name];
      }

      const out = { name, sets, repRange: [range[0], range[1]], targetRir: rir, restSeconds: rest, currentLoad, loadUnit };
      if (ex.priority) out.priority = String(ex.priority);
      if (ex.failure_allowed !== undefined) out.failureAllowed = !!ex.failure_allowed;
      if (ex.special_note) out.specialNote = String(ex.special_note);
      if (ex.superset_group) out.supersetGroup = String(ex.superset_group);
      return out;
    });
    result[day] = { focus: Array.isArray(src.focus) ? src.focus.map(String) : [], exercises };
  });
  return result;
}

export function diffPlan(newDays) {
  const plan = load().plan;
  return Object.keys(newDays).map(day => {
    const oldNames = new Set((plan[day] ? plan[day].exercises : []).map(e => e.name));
    const newNames = new Set(newDays[day].exercises.map(e => e.name));
    return {
      day,
      count: newDays[day].exercises.length,
      added: [...newNames].filter(n => !oldNames.has(n)),
      removed: [...oldNames].filter(n => !newNames.has(n))
    };
  });
}

// Sostituisce solo i giorni presenti in newDays. Sessioni e misurazioni non vengono toccate.
export function applyPlan(newDays) {
  const s = load();
  s.plan = Object.assign({}, s.plan, newDays);
  persist();
  localStorage.removeItem("workoutTrackerDraft");
}

export function importJSON(jsonText) {
  const parsed = JSON.parse(jsonText);
  state = Object.assign(emptyState(), parsed);
  persist();
}

export function resetAllData() {
  state = emptyState();
  persist();
}
