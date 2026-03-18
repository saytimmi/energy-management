import { signal } from "@preact/signals";

export type Route = "hub" | "energy" | "timeline" | "journal";

export const currentRoute = signal<Route>("hub");

export function navigate(route: Route): void {
  window.location.hash = route;
}

function syncRoute(): void {
  const hash = window.location.hash.slice(1) as Route;
  const valid: Route[] = ["hub", "energy", "timeline", "journal"];
  currentRoute.value = valid.includes(hash) ? hash : "hub";
}

export function initRouter(): void {
  syncRoute();
  window.addEventListener("hashchange", syncRoute);
}
