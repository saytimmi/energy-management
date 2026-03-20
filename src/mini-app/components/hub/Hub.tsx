import { useEffect } from "preact/hooks";
import { EnergyCard } from "./EnergyCard";
import { HabitsCard } from "./HabitsCard";
import { loadInitialData, isLoading, hasError, hasNoData } from "../../store/energy";
import { LoadingScreen, WelcomeScreen, ErrorScreen } from "../shared/Loading";
import { getTelegramUser } from "../../telegram";

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
        <div class="date">{now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })}</div>
      </header>
      <main class="views">
        <div class="hub-grid">
          <EnergyCard />
          {/* Phase 2: BalanceCard */}
          <HabitsCard />
          {/* Phase 4: TasksCard */}
        </div>
      </main>
    </div>
  );
}
