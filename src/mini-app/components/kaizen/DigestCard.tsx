import type { WeeklyDigestData } from "../../api/types";
import { haptic } from "../../telegram";

interface Props {
  digest: WeeklyDigestData;
  onTap: (digest: WeeklyDigestData) => void;
}

const ENERGY_EMOJI: Record<string, string> = {
  physical: "💪", mental: "🧠", emotional: "❤️", spiritual: "✨",
};

export function DigestCard({ digest, onTap }: Props) {
  const weekStart = new Date(digest.weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatDate = (d: Date) =>
    `${d.getDate()} ${["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"][d.getMonth()]}`;

  const trend = digest.content.energyTrend;

  return (
    <div
      class="digest-card"
      onClick={() => { haptic("light"); onTap(digest); }}
    >
      <div class="digest-card-header">
        <span class="digest-card-icon">📊</span>
        <span class="digest-card-dates">{formatDate(weekStart)} — {formatDate(weekEnd)}</span>
        <span class="digest-card-arrow">›</span>
      </div>

      {trend && (
        <div class="digest-card-trends">
          {Object.entries(trend).map(([type, data]) => {
            const arrow = data.delta > 0 ? "↑" : data.delta < 0 ? "↓" : "→";
            return (
              <span key={type} class={`digest-trend${data.delta > 0 ? " up" : data.delta < 0 ? " down" : ""}`}>
                {ENERGY_EMOJI[type] || "•"} {data.thisWeek}{arrow}
              </span>
            );
          })}
        </div>
      )}

      {digest.content.totalCheckins && (
        <div class="digest-card-meta">
          {digest.content.totalCheckins} чекинов
          {digest.content.bestDay && ` · лучший: ${digest.content.bestDay}`}
        </div>
      )}
    </div>
  );
}
