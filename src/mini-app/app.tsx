import { currentRoute, currentParam, initRouter } from "./router";
import { initTelegram, syncTheme, onActivated } from "./telegram";
import { Hub } from "./components/hub/Hub";
import { EnergyDashboard } from "./components/energy/EnergyDashboard";
import { HabitsScreen } from "./components/habits/HabitsScreen";
import { BalanceScreen } from "./components/balance/BalanceScreen";
import { KaizenScreen } from "./components/kaizen/KaizenScreen";
import { BottomNav } from "./components/shared/BottomNav";
import { useEffect } from "preact/hooks";
import { resetEnergyCache, loadInitialData as loadEnergy } from "./store/energy";
import { resetBalanceCache, loadBalanceOverview } from "./store/balance";
import { loadHabits } from "./store/habits";

export function App() {
  useEffect(() => {
    initTelegram();
    syncTheme();
    initRouter();

    // Reload data when returning from Telegram
    onActivated(() => {
      resetEnergyCache();
      loadEnergy();
      resetBalanceCache();
      loadBalanceOverview();
      loadHabits();
    });
  }, []);

  const route = currentRoute.value;
  const param = currentParam.value;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <>
      <div key={route} class="screen-enter">
        {route === "hub" && <Hub />}
        {route === "energy" && <EnergyDashboard />}
        {route === "habits" && <HabitsScreen />}
        {route === "balance" && <BalanceScreen param={param} />}
        {route === "kaizen" && <KaizenScreen param={param} />}
      </div>
      <BottomNav />
    </>
  );
}
