import { currentRoute, initRouter } from "./router";
import { initTelegram, syncTheme } from "./telegram";
import { Hub } from "./components/hub/Hub";
import { EnergyDashboard } from "./components/energy/EnergyDashboard";
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
      {route === "hub" && <Hub />}
      {route === "energy" && <EnergyDashboard />}
      {route === "habits" && <div class="screen"><p style={{padding: "20px", textAlign: "center"}}>Привычки — скоро!</p></div>}
      {route === "journal" && <Journal />}
      <BottomNav />
    </>
  );
}
