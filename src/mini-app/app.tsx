import { currentRoute, initRouter } from "./router";
import { initTelegram, syncTheme } from "./telegram";
import { EnergyDashboard } from "./components/energy/EnergyDashboard";
import { Timeline } from "./components/timeline/Timeline";
import { Journal } from "./components/journal/Journal";
import { BottomNav } from "./components/shared/BottomNav";
import { useEffect } from "preact/hooks";

export function App() {
  useEffect(() => {
    initTelegram();
    syncTheme();
    initRouter();
  }, []);

  const route = currentRoute.value;

  return (
    <>
      {(route === "hub" || route === "energy") && <EnergyDashboard />}
      {route === "timeline" && <Timeline />}
      {route === "journal" && <Journal />}
      <BottomNav />
    </>
  );
}
