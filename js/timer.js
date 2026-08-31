export function createRestTimer({ seconds, onTick, onDone }) {
  let remaining = seconds;
  let intervalId = null;
  let running = false;

  function tick() {
    remaining -= 1;
    onTick(remaining);
    if (remaining <= 0) {
      stop();
      onDone();
    }
  }

  function start() {
    if (running) return;
    running = true;
    intervalId = setInterval(tick, 1000);
  }

  function stop() {
    running = false;
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  function addSeconds(delta) {
    remaining = Math.max(0, remaining + delta);
    onTick(remaining);
  }

  start();

  return {
    stop,
    addSeconds,
    getRemaining: () => remaining
  };
}

export function formatMMSS(totalSeconds) {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
