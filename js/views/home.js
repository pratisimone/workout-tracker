import { getLastSession, getSessionsForDay } from "../storage.js";
import { DAY_SEQUENCE } from "../data/planData.js";

function daysSince(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  const diffMs = now.setHours(0, 0, 0, 0) - then.setHours(0, 0, 0, 0);
  return Math.round(diffMs / 86400000);
}

function suggestNextDay(lastSession) {
  if (!lastSession) return "A";
  const idx = DAY_SEQUENCE.indexOf(lastSession.day);
  if (idx === -1) return "A";
  return DAY_SEQUENCE[(idx + 1) % DAY_SEQUENCE.length];
}

export function render(container) {
  const lastSession = getLastSession();
  const nextDay = suggestNextDay(lastSession);
  const daysAgo = lastSession ? daysSince(lastSession.date) : null;

  const dayButtons = DAY_SEQUENCE.map(day => {
    const count = getSessionsForDay(day).length;
    return `
      <button class="day-btn" data-day="${day}">
        <span class="day-btn-letter">${day}</span>
        <span class="day-btn-count">${count} sessioni</span>
      </button>
    `;
  }).join("");

  container.innerHTML = `
    <div class="screen home-screen">
      <h1 class="app-title">Workout Tracker</h1>
      <div class="day-grid">${dayButtons}</div>

      <div class="card">
        <div class="card-label">Ultimo allenamento</div>
        ${lastSession
          ? `<div class="card-value">Giorno ${lastSession.day} &middot; ${lastSession.date}</div>
             <div class="card-sub">${daysAgo === 0 ? "Oggi" : daysAgo === 1 ? "1 giorno fa" : `${daysAgo} giorni fa`}</div>`
          : `<div class="card-value">Nessun allenamento registrato</div>`}
      </div>

      <div class="card card-highlight">
        <div class="card-label">Prossimo allenamento</div>
        <div class="card-value-big">Giorno ${nextDay}</div>
        <button class="primary-btn" id="start-suggested">INIZIA ALLENAMENTO</button>
      </div>
    </div>
  `;

  container.querySelectorAll(".day-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      location.hash = `#/workout/${btn.dataset.day}`;
    });
  });
  container.querySelector("#start-suggested").addEventListener("click", () => {
    location.hash = `#/workout/${nextDay}`;
  });
}
