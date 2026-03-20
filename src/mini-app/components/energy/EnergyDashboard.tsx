import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { dashboardData, observations, analyticsData, loadInitialData, isLoading, hasError, hasNoData } from "../../store/energy";
import { EnergyRings } from "./EnergyRings";
import { Observations } from "./Observations";
import { Analytics } from "./Analytics";
import { Timeline } from "../timeline/Timeline";
import { LoadingScreen, WelcomeScreen, ErrorScreen } from "../shared/Loading";
import { getDayWord } from "./utils";
import { api } from "../../api/client";
import { haptic, getTelegramUser } from "../../telegram";

const checkinState = signal<"idle" | "sending" | "sent">("idle");

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

  const handleCheckin = async () => {
    if (checkinState.value !== "idle") return;
    haptic("medium");
    checkinState.value = "sending";
    try {
      await api.triggerCheckin();
      checkinState.value = "sent";
      setTimeout(() => { checkinState.value = "idle"; }, 3000);
    } catch { checkinState.value = "idle"; }
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
            <summary style={{padding: "12px 0", fontWeight: 500, cursor: "pointer"}}>📊 Динамика</summary>
            <Timeline />
          </details>
          <Observations observations={obs} />
          {analytics && <Analytics data={analytics} />}
          <button class="quick-checkin-btn" onClick={handleCheckin} disabled={checkinState.value !== "idle"}>
            {checkinState.value === "sending" ? "Отправляю..." : checkinState.value === "sent" ? "✓ Бот напишет тебе" : "⚡ Записать энергию"}
          </button>
        </section>
      </main>
    </div>
  );
}
