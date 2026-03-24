import { useEffect } from "preact/hooks";
import { RadarChart } from "./RadarChart";
import { BalanceDetail } from "./BalanceDetail";
import {
  balanceOverview, radarData, balanceLoading, balanceError,
  loadBalanceOverview,
} from "../../store/balance";
import { navigate } from "../../router";
import { haptic } from "../../telegram";
import type { BalanceAreaSummary } from "../../api/types";

interface BalanceScreenProps {
  param?: string;
}

export function BalanceScreen({ param }: BalanceScreenProps) {
  // If param is an area name, show detail
  const VALID_AREAS = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];
  if (param && VALID_AREAS.includes(param)) {
    return <BalanceDetail area={param} />;
  }

  // Main balance screen
  useEffect(() => { loadBalanceOverview(); }, []);

  const overview = balanceOverview.value;
  const radar = radarData.value;
  const loading = balanceLoading.value;
  const error = balanceError.value;

  const handleAreaClick = (area: string) => {
    haptic("light");
    navigate("balance", area);
  };

  const handleAssess = () => {
    haptic("medium");
    // Deep link to Telegram bot
    const botUsername = getBotUsername();
    if (botUsername) {
      window.open(`https://t.me/${botUsername}?text=${encodeURIComponent("баланс")}`, "_blank");
    }
  };

  if (loading && !overview) {
    return (
      <div class="screen">
        <header class="app-header">
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>⚖️ Баланс жизни</h1>
        </header>
        <main class="views" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div class="pulse-ring" />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div class="screen">
        <header class="app-header">
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>⚖️ Баланс жизни</h1>
        </header>
        <main class="views" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
          Ошибка загрузки данных
        </main>
      </div>
    );
  }

  const hasAnyScores = overview && overview.ratedCount > 0;

  return (
    <div class="screen">
      <header class="app-header">
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>⚖️ Баланс жизни</h1>
        {overview && overview.avgScore !== null && (
          <span style={{ fontSize: "13px", color: "var(--text2)", fontWeight: 400 }}>
            Средний: {overview.avgScore}/10
          </span>
        )}
      </header>
      <main class="views">
        {/* Radar Chart */}
        {radar && hasAnyScores ? (
          <div class="balance-radar-card">
            <RadarChart points={radar.points} />
          </div>
        ) : (
          <div class="balance-empty-radar">
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚖️</div>
            <div style={{ fontSize: "14px", color: "var(--text2)", marginBottom: "16px", lineHeight: 1.5 }}>
              Оцени баланс жизни через AI коуча — он поможет разобрать каждую сферу по аспектам
            </div>
            <button class="balance-assess-btn" onClick={handleAssess}>
              Оценить баланс
            </button>
          </div>
        )}

        {/* Assess button (when data exists) */}
        {hasAnyScores && (
          <button class="balance-reassess-btn" onClick={handleAssess}>
            🔄 Обновить оценку через AI коуча
          </button>
        )}

        {/* Area list */}
        {overview && (
          <div class="balance-area-list">
            {/* Focus areas first, then by score ascending (worst first) */}
            {sortAreas(overview.areas).map(area => (
              <AreaRow key={area.area} area={area} onClick={() => handleAreaClick(area.area)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function sortAreas(areas: BalanceAreaSummary[]): BalanceAreaSummary[] {
  return [...areas].sort((a, b) => {
    // Focus areas first
    if (a.isFocus && !b.isFocus) return -1;
    if (!a.isFocus && b.isFocus) return 1;
    // Then by score ascending (critical first), null last
    const sa = a.score ?? 99;
    const sb = b.score ?? 99;
    return sa - sb;
  });
}

interface AreaRowProps {
  area: BalanceAreaSummary;
  onClick: () => void;
}

function AreaRow({ area, onClick }: AreaRowProps) {
  const scoreColor = area.score !== null
    ? area.score <= 4 ? "#ff5b5b" : area.score <= 6 ? "#ffa85b" : "#5be07a"
    : "var(--text3)";

  return (
    <div class="balance-area-row" onClick={onClick}>
      <div class="balance-area-left">
        <span class="balance-area-icon">{area.icon}</span>
        <div>
          <div class="balance-area-name">
            {area.label}
            {area.isFocus && <span class="balance-focus-badge">фокус</span>}
          </div>
          <div class="balance-area-meta">
            {area.habitCount > 0 ? `${area.habitCount} привычек` : "нет привычек"}
          </div>
        </div>
      </div>
      <div class="balance-area-right">
        <span class="balance-area-score" style={{ color: scoreColor }}>
          {area.score !== null ? `${area.score}/10` : "—"}
        </span>
        <span class="balance-area-arrow">›</span>
      </div>
    </div>
  );
}

function getBotUsername(): string | null {
  try {
    return (window as any).Telegram?.WebApp?.initDataUnsafe?.user ? "energy_coach_bot" : null;
  } catch {
    return null;
  }
}
