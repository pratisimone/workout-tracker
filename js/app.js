import { registerRoute, startRouter } from "./router.js";
import * as home from "./views/home.js";
import * as workout from "./views/workout.js";
import * as history from "./views/history.js";
import * as progress from "./views/progress.js";
import * as settings from "./views/settings.js";

registerRoute("/home", home);
registerRoute("/workout/:day", workout);
registerRoute("/history", history);
registerRoute("/progress", progress);
registerRoute("/settings", settings);

const NAV_ROUTES = ["/home", "/history", "/progress", "/settings"];

function updateNav(hash) {
  const nav = document.getElementById("bottom-nav");
  const path = hash.replace(/^#/, "") || "/home";
  const isWorkout = path.startsWith("/workout");
  nav.classList.toggle("nav-hidden", isWorkout);
  nav.querySelectorAll("button").forEach(btn => {
    btn.classList.toggle("nav-active", path === btn.dataset.route);
  });
}

document.getElementById("bottom-nav").querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => {
    location.hash = `#${btn.dataset.route}`;
  });
});

startRouter(document.getElementById("app"), { onNavigate: updateNav });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
