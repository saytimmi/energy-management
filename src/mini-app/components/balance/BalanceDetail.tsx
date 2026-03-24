import { useEffect } from "preact/hooks";
import {
  balanceDetail, balanceLoading, balanceError,
  loadBalanceArea,
} from "../../store/balance";
import { navigate } from "../../router";
import { haptic, showBackButton, hideBackButton } from "../../telegram";

interface BalanceDetailProps {
  area: string;
}

export function BalanceDetail({ area }: BalanceDetailProps) {
  useEffect(() => {
    loadBalanceArea(area);
    const goBack = () => {
      haptic("light");
      navigate("balance");
    };
    showBackButton(goBack);
    return () => hideBackButton();
  }, [area]);

  const detail = balanceDetail.value;
  const loading = balanceLoading.value;
  const error = balanceError.value;

  if (loading && !detail) {
    return (
      <div class="screen">
        <header class="app-header">
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>Загрузка...</h1>
        </header>
        <main class="views" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div class="pulse-ring" />
        </main>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div class="screen">
        <header class="app-header">
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>Ошибка</h1>
        </header>
        <main class="views" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
          Не удалось загрузить данные
        </main>
      </div>
    );
  }

  const scoreColor = detail.score !== null
    ? detail.score <= 4 ? "#ff5b5b" : detail.score <= 6 ? "#ffa85b" : "#5be07a"
    : "var(--text3)";

  const progressPercent = detail.score !== null && detail.targetScore
    ? Math.min(100, Math.round((detail.score / detail.targetScore) * 100))
    : null;

  return (
    <div class="screen">
      <header class="app-header">
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>
          {detail.icon} {detail.label}
        </h1>
      </header>
      <main class="views">
        {/* Score + Target + Progress */}
        <div class="balance-detail-score-card">
          <div class="balance-detail-score-row">
            <div>
              <div class="balance-detail-score" style={{ color: scoreColor }}>
                {detail.score !== null ? detail.score : "—"}
              </div>
              <div class="balance-detail-score-label">из 10</div>
            </div>
            {detail.targetScore && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "22px", fontWeight: 600, color: "var(--text2)" }}>
                  → {detail.targetScore}
                </div>
                <div class="balance-detail-score-label">цель</div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {progressPercent !== null && (
            <div class="balance-detail-progress">
              <div class="balance-detail-progress-bar" style={{ width: `${progressPercent}%` }} />
            </div>
          )}

          {/* Identity */}
          {detail.identity && (
            <div class="balance-detail-identity">
              🪞 {detail.identity}
            </div>
          )}

          {detail.isFocus && (
            <span class="balance-focus-badge" style={{ marginTop: "8px" }}>В фокусе</span>
          )}
        </div>

        {/* SubScores / Aspects */}
        {detail.aspects.length > 0 && (
          <div class="balance-detail-section">
            <div class="section-title">Аспекты</div>
            {detail.aspects.map(aspect => (
              <div key={aspect.key} class="balance-aspect-row">
                <span class="balance-aspect-label">{aspect.label}</span>
                <div class="balance-aspect-bar-container">
                  <div
                    class="balance-aspect-bar"
                    style={{
                      width: aspect.score !== null ? `${(aspect.score / 10) * 100}%` : "0%",
                      background: aspect.score !== null
                        ? aspect.score <= 4 ? "#ff5b5b" : aspect.score <= 6 ? "#ffa85b" : "#5be07a"
                        : "var(--text3)",
                    }}
                  />
                </div>
                <span class="balance-aspect-score">
                  {aspect.score !== null ? aspect.score : "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Note / AI insight */}
        {detail.note && (
          <div class="balance-detail-section">
            <div class="section-title">Инсайт</div>
            <div class="balance-detail-note">{detail.note}</div>
          </div>
        )}

        {/* Habits */}
        {detail.habits.length > 0 && (
          <div class="balance-detail-section">
            <div class="section-title">Привычки</div>
            {detail.habits.map(h => (
              <div key={h.id} class="balance-habit-row">
                <span>{h.icon} {h.name}</span>
                <span style={{ fontSize: "12px", color: "var(--text3)" }}>
                  🔥 {h.streakCurrent} · {Math.round(h.consistency30d * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Auto-metrics */}
        {Object.keys(detail.autoMetrics).length > 0 && (
          <div class="balance-detail-section">
            <div class="section-title">Автометрики</div>
            {Object.entries(detail.autoMetrics).map(([key, val]) => (
              <div key={key} class="balance-auto-metric">
                <span style={{ color: "var(--text2)", fontSize: "13px" }}>
                  {key === "avgPhysicalEnergy" ? "Средняя физическая энергия (7 дней)" : key}
                </span>
                <span style={{ fontWeight: 600 }}>{val !== null ? val : "—"}</span>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {detail.history.length > 1 && (
          <div class="balance-detail-section">
            <div class="section-title">История оценок</div>
            {detail.history.slice(0, 5).map((entry, i) => (
              <div key={i} class="balance-history-row">
                <span style={{ fontSize: "12px", color: "var(--text3)" }}>
                  {new Date(entry.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </span>
                <span style={{ fontWeight: 600 }}>{entry.score}/10</span>
                <span style={{ fontSize: "11px", color: "var(--text3)" }}>
                  {entry.assessmentType === "ai_guided" ? "AI" : "субъ."}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom spacing for nav */}
        <div style={{ height: "80px" }} />
      </main>
    </div>
  );
}
