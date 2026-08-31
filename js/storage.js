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

export function importJSON(jsonText) {
  const parsed = JSON.parse(jsonText);
  state = Object.assign(emptyState(), parsed);
  persist();
}

export function resetAllData() {
  state = emptyState();
  persist();
}
