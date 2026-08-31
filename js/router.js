const routes = {};

export function registerRoute(pattern, view) {
  routes[pattern] = view;
}

function matchRoute(hash) {
  const path = hash.replace(/^#/, "") || "/home";
  const segments = path.split("/").filter(Boolean);

  for (const pattern of Object.keys(routes)) {
    const patternSegments = pattern.split("/").filter(Boolean);
    if (patternSegments.length !== segments.length) continue;
    const params = {};
    const isMatch = patternSegments.every((seg, i) => {
      if (seg.startsWith(":")) {
        params[seg.slice(1)] = segments[i];
        return true;
      }
      return seg === segments[i];
    });
    if (isMatch) return { view: routes[pattern], params };
  }
  return null;
}

export function startRouter(container, { onNavigate } = {}) {
  function handle() {
    const match = matchRoute(location.hash);
    if (!match) {
      location.hash = "#/home";
      return;
    }
    if (onNavigate) onNavigate(location.hash);
    container.innerHTML = "";
    match.view.render(container, match.params);
  }

  window.addEventListener("hashchange", handle);
  handle();
}
