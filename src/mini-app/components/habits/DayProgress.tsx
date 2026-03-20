interface DayProgressProps {
  completed: number;
  total: number;
  streak: number;
  consistency: number;
}

function formatDate(): string {
  const now = new Date();
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
}

export function DayProgress({ completed, total, streak, consistency }: DayProgressProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div class="day-progress">
      <div class="day-progress-header">
        <span style={{ fontSize: "16px", fontWeight: 600 }}>Сегодня</span>
        <span style={{ fontSize: "13px", opacity: 0.6 }}>{formatDate()}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
        <div class="progress-bar-track" style={{ flex: 1 }}>
          <div class="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span style={{ fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap" }}>
          {completed}/{total}
        </span>
      </div>

      <div class="progress-stats">
        {streak > 0 && <span>🔥 {streak} {getDayWord(streak)}</span>}
        {total > 0 && <span>📊 {consistency}%</span>}
      </div>
    </div>
  );
}

function getDayWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "дней";
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
}
