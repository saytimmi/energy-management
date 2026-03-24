import type { WeeklyDigestData } from "../../api/types";
import { haptic } from "../../telegram";

interface Props {
  digest: WeeklyDigestData;
  onBack: () => void;
}

const ENERGY_LABELS: Record<string, string> = {
  physical: "Физическая", mental: "Ментальная", emotional: "Эмоциональная", spiritual: "Духовная",
};
const ENERGY_EMOJI: Record<string, string> = {
  physical: "💪", mental: "🧠", emotional: "❤️", spiritual: "✨",
};
const AREA_LABELS: Record<string, string> = {
  health: "Здоровье", career: "Карьера", relationships: "Отношения",
  finances: "Финансы", family: "Семья", growth: "Развитие",
  recreation: "Отдых", environment: "Среда",
};

export function DigestDetail({ digest, onBack }: Props) {
  const c = digest.content;

  const weekStart = new Date(digest.weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatDate = (d: Date) =>
    `${d.getDate()} ${["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"][d.getMonth()]}`;

  return (
    <div class="digest-detail">
      <div class="digest-detail-header">
        <button class="back-btn" onClick={() => { haptic("light"); onBack(); }}>←</button>
        <h2>📊 {formatDate(weekStart)} — {formatDate(weekEnd)}</h2>
      </div>

      {/* Energy Trends */}
      {c.energyTrend && (
        <div class="digest-section">
          <div class="digest-section-title">Тренды энергии</div>
          {Object.entries(c.energyTrend).map(([type, data]) => {
            const arrow = data.delta > 0 ? "↑" : data.delta < 0 ? "↓" : "→";
            const deltaStr = data.delta > 0 ? `+${data.delta}` : `${data.delta}`;
            return (
              <div key={type} class="digest-trend-row">
                <span>{ENERGY_EMOJI[type]} {ENERGY_LABELS[type] || type}</span>
                <span class={`digest-trend-value${data.delta > 0 ? " up" : data.delta < 0 ? " down" : ""}`}>
                  {data.thisWeek}/10 ({arrow}{deltaStr})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Days */}
      {(c.bestDay || c.worstDay) && (
        <div class="digest-section">
          {c.bestDay && <div class="digest-day-item">📅 Лучший: {c.bestDay}</div>}
          {c.worstDay && <div class="digest-day-item">📅 Худший: {c.worstDay}</div>}
        </div>
      )}

      {/* Drop Triggers */}
      {c.topDropTriggers && c.topDropTriggers.length > 0 && (
        <div class="digest-section">
          <div class="digest-section-title">🔻 Что роняет энергию</div>
          {c.topDropTriggers.map((t, i) => (
            <div key={i} class="digest-trigger-item">
              <span class="digest-trigger-name">{t.trigger}</span>
              <span class="digest-trigger-count">{t.count}x</span>
            </div>
          ))}
        </div>
      )}

      {/* Rise Triggers */}
      {c.topRiseTriggers && c.topRiseTriggers.length > 0 && (
        <div class="digest-section">
          <div class="digest-section-title">🔺 Что поднимает</div>
          {c.topRiseTriggers.map((t, i) => (
            <div key={i} class="digest-trigger-item">
              <span class="digest-trigger-name">{t.trigger}</span>
              <span class="digest-trigger-count">{t.count}x</span>
            </div>
          ))}
        </div>
      )}

      {/* Habits */}
      {c.habits && c.habits.length > 0 && (
        <div class="digest-section">
          <div class="digest-section-title">💪 Привычки</div>
          {c.habits.map((h, i) => (
            <div key={i} class="digest-habit-row">
              <span>{h.icon} {h.name}</span>
              <span class="digest-habit-stats">
                {h.streak > 0 && `🔥${h.streak} `}
                {Math.round(h.strength)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Goals */}
      {c.goalsProgress && c.goalsProgress.length > 0 && (
        <div class="digest-section">
          <div class="digest-section-title">🎯 Цели</div>
          {c.goalsProgress.map((g, i) => (
            <div key={i} class="digest-goal-item">
              {AREA_LABELS[g.lifeArea] || g.lifeArea}: {g.title}
            </div>
          ))}
        </div>
      )}

      <div class="digest-meta">{c.totalCheckins ?? 0} чекинов за неделю</div>
    </div>
  );
}
