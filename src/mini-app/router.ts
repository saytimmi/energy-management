import { signal } from "@preact/signals";

export type Route = "hub" | "energy" | "habits" | "journal";

export const currentRoute = signal<Route>("hub");

export function navigate(route: Route): void {
  window.location.hash = route;
}

function syncRoute(): void {
  const hash = window.location.hash.slice(1);
  if (hash === "timeline") {
    window.location.hash = "energy";
    return;
  }
  const valid: Route[] = ["hub", "energy", "habits", "journal"];
  currentRoute.value = valid.includes(hash as Route) ? (hash as Route) : "hub";
}

export function initRouter(): void {
  syncRoute();
  window.addEventListener("hashchange", syncRoute);
}
