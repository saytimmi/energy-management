import { useEffect } from "preact/hooks";
import { EnergyCard } from "./EnergyCard";
import { BalanceCard } from "./BalanceCard";
import { HabitsCard } from "./HabitsCard";
import { KaizenCard } from "./KaizenCard";
import { StrategyCard } from "./StrategyCard";
import { loadInitialData, isLoading, hasError, hasNoData } from "../../store/energy";
import { LoadingScreen, WelcomeScreen, ErrorScreen } from "../shared/Loading";
import { getTelegramUser, haptic } from "../../telegram";
import { navigate } from "../../router";

export function Hub() {
  useEffect(() => { loadInitialData(); }, []);

  if (isLoading.value) return <LoadingScreen />;
  if (hasError.value) return <ErrorScreen />;
  if (hasNoData.value) return <WelcomeScreen />;

  const user = getTelegramUser();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? "Доброй ночи," : hour < 12 ? "Доброе утро," : hour < 18 ? "Добрый день," : "Добрый вечер,";

  return (
    <div class="screen" style={{ display: "flex", flexDirection: "column" }}>
      <header class="app-header">
        <div class="header-left">
          <div class="greeting">
            <span class="greeting-hi">{greeting}</span>
            <span class="greeting-name">{user?.first_name ?? ""}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div class="date">{now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })}</div>
          <button class="hub-settings-btn" onClick={() => { haptic("light"); navigate("settings"); }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M16.2 12.2a1.4 1.4 0 00.3 1.5l.05.05a1.7 1.7 0 11-2.4 2.4l-.05-.05a1.4 1.4 0 00-1.5-.3 1.4 1.4 0 00-.85 1.28v.15a1.7 1.7 0 11-3.4 0v-.08a1.4 1.4 0 00-.92-1.28 1.4 1.4 0 00-1.5.3l-.05.05a1.7 1.7 0 11-2.4-2.4l.05-.05a1.4 1.4 0 00.3-1.5 1.4 1.4 0 00-1.28-.85h-.15a1.7 1.7 0 110-3.4h.08A1.4 1.4 0 003.7 7a1.4 1.4 0 00-.3-1.5l-.05-.05a1.7 1.7 0 112.4-2.4l.05.05a1.4 1.4 0 001.5.3h.07a1.4 1.4 0 00.85-1.28v-.15a1.7 1.7 0 013.4 0v.08a1.4 1.4 0 00.85 1.28 1.4 1.4 0 001.5-.3l.05-.05a1.7 1.7 0 112.4 2.4l-.05.05a1.4 1.4 0 00-.3 1.5v.07a1.4 1.4 0 001.28.85h.15a1.7 1.7 0 010 3.4h-.08a1.4 1.4 0 00-1.28.85z" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
        </div>
      </header>
      <main class="views">
        <div class="hub-grid">
          <EnergyCard />
          <BalanceCard />
          <HabitsCard />
          <StrategyCard />
          <KaizenCard />
        </div>
      </main>
    </div>
  );
}
