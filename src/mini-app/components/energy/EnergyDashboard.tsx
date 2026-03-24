import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { dashboardData, observations, analyticsData, loadInitialData, isLoading, hasError, hasNoData, resetEnergyCache } from "../../store/energy";
import { EnergyRings } from "./EnergyRings";
import { EnergyCheckinOverlay } from "./EnergyCheckinOverlay";
import { Observations } from "./Observations";
import { Analytics } from "./Analytics";
import { Timeline } from "../timeline/Timeline";
import { LoadingScreen, WelcomeScreen, ErrorScreen } from "../shared/Loading";
import { getDayWord } from "./utils";
import { haptic, getTelegramUser } from "../../telegram";

const showCheckin = signal(false);

export function EnergyDashboard() {
  useEffect(() => { loadInitialData(); }, []);

  if (isLoading.value) return <LoadingScreen />;
  if (hasError.value) return <ErrorScreen />;
  if (hasNoData.value) return <WelcomeScreen />;

  const data = dashboardData.value;
  const obs = observations.value;
  const analytics = analyticsData.value;
  const user = getTelegramUser();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? "Доброй ночи," : hour < 12 ? "Доброе утро," : hour < 18 ? "Добрый день," : "Добрый вечер,";

  const handleCheckinComplete = () => {
    showCheckin.value = false;
    resetEnergyCache();
    loadInitialData();
  };

  return (
    <div class="screen" style={{ display: "flex", flexDirection: "column" }}>
      <header class="app-header">
        <div class="header-left">
          <div class="greeting">
            <span class="greeting-hi">{greeting}</span>
            <span class="greeting-name">{user?.first_name ?? ""}</span>
          </div>
          {data && data.streak > 0 && (
            <div class="streak-badge">🔥 {data.streak} {getDayWord(data.streak)} подряд</div>
          )}
        </div>
        <div class="date">{now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })}</div>
      </header>
      <main class="views">
        <section class="view">
          {data ? <EnergyRings data={data} /> : (
            <div class="dashboard-empty-msg">Расскажи боту как ты себя чувствуешь — я начну отслеживать 🌱</div>
          )}
          <details class="timeline-section">
            <summary>📊 Динамика</summary>
            <Timeline />
          </details>
          <Observations observations={obs} />
          {analytics && <Analytics data={analytics} />}
          <button class="quick-checkin-btn" onClick={() => { haptic("medium"); showCheckin.value = true; }}>
            ⚡ Записать энергию
          </button>
        </section>
      </main>

      {showCheckin.value && (
        <EnergyCheckinOverlay
          onClose={() => { showCheckin.value = false; }}
          onComplete={handleCheckinComplete}
          initialValues={data ? { physical: data.physical, mental: data.mental, emotional: data.emotional, spiritual: data.spiritual } : undefined}
        />
      )}
    </div>
  );
}
