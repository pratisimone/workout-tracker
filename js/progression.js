export const STATUS = {
  INCOMPLETE: "INCOMPLETE",
  MAINTAIN: "MAINTAIN",
  INCREASE: "INCREASE",
  DELOAD_OR_REVIEW: "DELOAD_OR_REVIEW"
};

export const STATUS_LABEL = {
  INCOMPLETE: { emoji: "⚪", text: "Da valutare" },
  MAINTAIN: { emoji: "🟡", text: "Mantieni" },
  INCREASE: { emoji: "🟢", text: "Aumenta" },
  DELOAD_OR_REVIEW: { emoji: "🔴", text: "Attenzione" }
};

function average(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function totalReps(sets) {
  return sets.reduce((sum, s) => sum + (Number(s.reps) || 0), 0);
}

function maxPain(sets) {
  const pains = sets.map(s => s.pain).filter(p => p !== null && p !== undefined);
  return pains.length ? Math.max(...pains) : null;
}

function roundLoad(load, loadUnit) {
  if (load === null || load === undefined) return null;
  const step = loadUnit === "bodyweight" ? 0 : load >= 20 ? 1 : 0.5;
  if (step === 0) return load;
  return Math.round(load / step) * step;
}

export function suggestNextLoad(currentLoad, loadUnit, incrementPercent) {
  if (currentLoad === null || currentLoad === undefined) return null;
  if (loadUnit === "bodyweight") return currentLoad;
  const raw = currentLoad * (1 + incrementPercent / 100);
  const rounded = roundLoad(raw, loadUnit);
  return rounded > currentLoad ? rounded : currentLoad + (loadUnit === "kg" || loadUnit === "kg_per_hand" ? (currentLoad >= 20 ? 1 : 0.5) : 0);
}

export function nextRepGoals(sets, repRange) {
  const [min, max] = repRange;
  return sets.map(s => Math.min(Math.max(Number(s.reps) || min, min) + 1, max));
}

/**
 * Valuta una ExerciseSession rispetto alla definizione dell'esercizio e alla sessione precedente.
 * Non modifica mai target RIR o range reps: quelli restano quelli del piano.
 */
export function evaluateExercise({ def, sets, previousExerciseSession, settings }) {
  const [minReps, maxReps] = def.repRange;
  const incrementPercent = (settings && settings.loadIncrementPercent) || 3.5;

  if (!sets || sets.length === 0) {
    return {
      status: STATUS.INCOMPLETE,
      reason: "Nessuna serie registrata.",
      nextLoad: def.currentLoad,
      nextRepGoalText: `${minReps}–${maxReps}`
    };
  }

  const painNow = maxPain(sets);
  const painPrev = previousExerciseSession ? maxPain(previousExerciseSession.sets) : null;
  const painIncreasing = painNow !== null && (painNow >= 6 || (painPrev !== null && painNow - painPrev >= 2));

  if (painIncreasing) {
    return {
      status: STATUS.DELOAD_OR_REVIEW,
      reason: `Dolore registrato (${painNow}/10)${painPrev !== null ? `, superiore alla sessione precedente (${painPrev}/10)` : ""}. Non aumentare il carico: privilegia tecnica e assenza di dolore.`,
      nextLoad: def.currentLoad,
      nextRepGoalText: `${minReps}–${maxReps}`
    };
  }

  if (previousExerciseSession) {
    const prevTotal = totalReps(previousExerciseSession.sets);
    const nowTotal = totalReps(sets);
    const samePrevLoad = previousExerciseSession.sets[0] && def.currentLoad !== null && previousExerciseSession.sets[0].load >= def.currentLoad;
    if (samePrevLoad && prevTotal > 0 && nowTotal < prevTotal * 0.85) {
      return {
        status: STATUS.DELOAD_OR_REVIEW,
        reason: `Calo di prestazione rispetto alla sessione precedente (${nowTotal} vs ${prevTotal} reps totali a parita' di carico). Valuta recupero, sonno e stress prima di proseguire.`,
        nextLoad: def.currentLoad,
        nextRepGoalText: `${minReps}–${maxReps}`
      };
    }
  }

  const allSetsAtMax = sets.every(s => Number(s.reps) >= maxReps);
  const avgRir = average(sets.map(s => Number(s.rir)));
  const rirOk = avgRir !== null && Math.abs(avgRir - def.targetRir) <= 1;

  if (allSetsAtMax && rirOk) {
    const nextLoad = suggestNextLoad(def.currentLoad, def.loadUnit, incrementPercent);
    return {
      status: STATUS.INCREASE,
      reason: `Hai raggiunto il massimo del range (${maxReps} reps) su tutte le serie rispettando il RIR target (${def.targetRir}). Puoi aumentare il carico.`,
      nextLoad,
      nextRepGoalText: `${minReps}–${maxReps}`
    };
  }

  const goals = nextRepGoals(sets, def.repRange);
  const repsDone = sets.map(s => s.reps).join("/");
  const reasonParts = [];
  if (!allSetsAtMax) reasonParts.push(`non hai ancora raggiunto ${maxReps} reps su tutte le serie`);
  if (!rirOk && avgRir !== null) reasonParts.push(`il RIR medio (${avgRir.toFixed(1)}) si discosta dal target (${def.targetRir})`);

  return {
    status: STATUS.MAINTAIN,
    reason: `Hai fatto ${repsDone}${reasonParts.length ? ": " + reasonParts.join(" e ") : ""}. Mantieni il carico e prova ad aumentare le reps.`,
    nextLoad: def.currentLoad,
    nextRepGoalText: goals.join("/") + "+"
  };
}
