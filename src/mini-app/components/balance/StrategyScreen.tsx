import { useEffect } from "preact/hooks";
import { strategyData, strategyLoading, strategyError, loadStrategy } from "../../store/strategy";
import { navigate } from "../../router";
import { haptic, openTelegramLink } from "../../telegram";
import type { StrategyArea } from "../../api/types";

export function StrategyScreen() {
  useEffect(() => { loadStrategy(); }, []);

  const handleBack = () => {
    haptic("light");
    navigate("balance");
  };

  const handleEditMission = () => {
    haptic("medium");
    openTelegramLink("energy_coach_bot?text=" + encodeURIComponent("Хочу определить миссию"));
  };

  const handleSetGoals = () => {
    haptic("medium");
    openTelegramLink("energy_coach_bot?text=" + encodeURIComponent("Поставить цели"));
  };

  if (strategyLoading.value) {
    return (
      <div class="screen">
        <header class="app-header">
          <button class="back-btn" onClick={handleBack}>←</button>
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>🧭 Стратегия</h1>
        </header>
        <main class="views">
          <div style={{ textAlign: "center", color: "var(--text2)", padding: 40 }}>Загрузка...</div>
        </main>
      </div>
    );
  }

  if (strategyError.value) {
    return (
      <div class="screen">
        <header class="app-header">
          <button class="back-btn" onClick={handleBack}>←</button>
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>🧭 Стратегия</h1>
        </header>
        <main class="views">
          <div style={{ textAlign: "center", color: "var(--text2)", padding: 40 }}>Ошибка загрузки</div>
        </main>
      </div>
    );
  }

  const data = strategyData.value;
  const mission = data?.mission;
  const hasMission = mission && (mission.identity || mission.purpose || mission.legacy || mission.statement);

  // Current quarter label
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const quarterLabel = `Q${quarter} ${now.getFullYear()}`;

  return (
    <div class="screen">
      <header class="app-header">
        <button class="back-btn" onClick={handleBack}>←</button>
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>🧭 Стратегия</h1>
      </header>
      <main class="views">
        {/* Mission Card */}
        <div class="strategy-mission-card">
          {hasMission ? (
            <>
              {mission!.statement && (
                <div class="strategy-mission-statement">"{mission!.statement}"</div>
              )}
              <div class="strategy-mission-questions">
                {mission!.identity && (
                  <div class="strategy-mission-item">
                    <span class="strategy-mission-icon">🪞</span>
                    <div>
                      <div class="strategy-mission-label">Кто я</div>
                      <div class="strategy-mission-text">{mission!.identity}</div>
                    </div>
                  </div>
                )}
                {mission!.purpose && (
                  <div class="strategy-mission-item">
                    <span class="strategy-mission-icon">🌍</span>
                    <div>
                      <div class="strategy-mission-label">Моё место</div>
                      <div class="strategy-mission-text">{mission!.purpose}</div>
                    </div>
                  </div>
                )}
                {mission!.legacy && (
                  <div class="strategy-mission-item">
                    <span class="strategy-mission-icon">🏛️</span>
                    <div>
                      <div class="strategy-mission-label">Наследие</div>
                      <div class="strategy-mission-text">{mission!.legacy}</div>
                    </div>
                  </div>
                )}
              </div>
              <button class="strategy-edit-btn" onClick={handleEditMission}>
                Обновить миссию
              </button>
            </>
          ) : (
            <div class="strategy-empty-mission">
              <div style={{ fontSize: 32, marginBottom: 8 }}>🧭</div>
              <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 12 }}>
                Миссия определяет направление жизни
              </div>
              <button class="strategy-cta-btn" onClick={handleEditMission}>
                Определить миссию
              </button>
            </div>
          )}
        </div>

        {/* Focus Areas */}
        {data && data.focusAreas.length > 0 && (
          <>
            <div class="section-title">В фокусе {quarterLabel}</div>
            {data.focusAreas.map(area => (
              <FocusAreaCard key={area.area} area={area} />
            ))}
          </>
        )}

        {/* Other Areas */}
        {data && data.otherAreas.length > 0 && (
          <>
            <div class="section-title">Остальные сферы</div>
            {data.otherAreas.map(area => (
              <CompactAreaCard key={area.area} area={area} />
            ))}
          </>
        )}

        {/* No goals at all */}
        {data && data.focusAreas.length === 0 && data.otherAreas.every(a => a.yearGoals.length === 0 && a.quarterGoals.length === 0) && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <button class="strategy-cta-btn" onClick={handleSetGoals}>
              Поставить цели
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Focus Area Card (expanded) ---

function FocusAreaCard({ area }: { area: StrategyArea }) {
  const handleAreaClick = () => {
    haptic("light");
    navigate("balance", area.area);
  };

  return (
    <div class="strategy-focus-card" onClick={handleAreaClick}>
      <div class="strategy-focus-header">
        <span class="strategy-focus-icon">{area.icon}</span>
        <span class="strategy-focus-name">{area.label}</span>
        {area.score !== null && (
          <span class="strategy-focus-score">{area.score}/10</span>
        )}
        <span class="strategy-focus-badge">фокус</span>
      </div>

      {area.identity && (
        <div class="strategy-identity">
          <span style={{ color: "var(--text3)", fontSize: 11 }}>Кем стану:</span>{" "}
          {area.identity}
        </div>
      )}

      {area.yearGoals.length > 0 && (
        <div class="strategy-goals-section">
          <div class="strategy-goals-label">Цель года</div>
          {area.yearGoals.map(g => (
            <div key={g.id} class="strategy-goal-item">{g.title}</div>
          ))}
        </div>
      )}

      {area.quarterGoals.length > 0 && (
        <div class="strategy-goals-section">
          <div class="strategy-goals-label">Цель квартала</div>
          {area.quarterGoals.map(g => (
            <div key={g.id} class="strategy-goal-item">{g.title}</div>
          ))}
        </div>
      )}

      {area.habits.length > 0 && (
        <div class="strategy-habits-chips">
          {area.habits.map(h => (
            <span key={h.id} class="strategy-habit-chip">
              {h.icon} {h.name}
              {h.streak > 0 && <span class="strategy-habit-streak">🔥{h.streak}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Compact Area Card ---

function CompactAreaCard({ area }: { area: StrategyArea }) {
  const handleClick = () => {
    haptic("light");
    navigate("balance", area.area);
  };

  const yearGoalText = area.yearGoals.length > 0 ? area.yearGoals[0].title : null;

  return (
    <div class="strategy-compact-card" onClick={handleClick}>
      <span class="strategy-compact-icon">{area.icon}</span>
      <div class="strategy-compact-info">
        <div class="strategy-compact-name">{area.label}</div>
        {yearGoalText && (
          <div class="strategy-compact-goal">{yearGoalText}</div>
        )}
      </div>
      {area.score !== null && (
        <span class="strategy-compact-score">{area.score}/10</span>
      )}
      <span class="strategy-compact-arrow">›</span>
    </div>
  );
}

