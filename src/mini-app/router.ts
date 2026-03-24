import { signal, computed } from "@preact/signals";

export type Route = "hub" | "energy" | "habits" | "journal" | "balance" | "kaizen";

const VALID_ROUTES: Route[] = ["hub", "energy", "habits", "journal", "balance", "kaizen"];

export interface ParsedRoute {
  route: Route;
  param?: string;
}

export function parseRoute(hash: string): ParsedRoute {
  const raw = hash.replace(/^#\/?/, "");
  if (!raw) return { route: "hub", param: undefined };

  const [first, ...rest] = raw.split("/");
  const route = VALID_ROUTES.includes(first as Route) ? (first as Route) : "hub";
  const param = rest.length > 0 ? rest.join("/") : undefined;

  return { route, param };
}

export const currentParsedRoute = signal<ParsedRoute>({ route: "hub", param: undefined });

export const currentRoute = computed<Route>(() => currentParsedRoute.value.route);
export const currentParam = computed<string | undefined>(() => currentParsedRoute.value.param);

export function navigate(route: Route, param?: string) {
  const hash = param ? `#${route}/${param}` : `#${route}`;
  window.location.hash = hash;
}

export function initRouter() {
  const update = () => {
    currentParsedRoute.value = parseRoute(window.location.hash);
  };
  window.addEventListener("hashchange", update);
  update();
}
