import { useEffect } from "preact/hooks";
import { habitsData, todayProgress, loadHabits } from "../../store/habits";
import { navigate } from "../../router";
import { haptic } from "../../telegram";
import { Card } from "../shared/Card";

const SLOT_EMOJI: Record<string, string> = {
  morning: "☀️",
  afternoon: "🌤",
  evening: "🌙",
};

export function HabitsCard() {
  useEffect(() => {
    if (!habitsData.value) loadHabits();
  }, []);

  const data = habitsData.value;
  const progress = todayProgress.value;

  function handleTap() {
    haptic("light");
    navigate("habits");
  }

  if (!data) {
    return (
      <Card class="hub-card" onClick={handleTap}>
        <div class="hub-card-header">
          <span class="hub-card-title">Привычки</span>
        </div>
        <div class="hub-card-empty">Загрузка...</div>
      </Card>
    );
  }

  const allHabits = [...data.morning, ...data.afternoon, ...data.evening];
  if (allHabits.length === 0) {
    return (
      <Card class="hub-card" onClick={handleTap}>
        <div class="hub-card-header">
          <span class="hub-card-title">Привычки</span>
        </div>
        <div class="hub-card-empty">Добавь первую привычку</div>
      </Card>
    );
  }

  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const maxStreak = allHabits.reduce((max, h) => Math.max(max, h.streakCurrent), 0);
  const avgConsistency = Math.round(allHabits.reduce((sum, h) => sum + h.consistency30d, 0) / allHabits.length);

  // Build dots per slot
  const slots = ["morning", "afternoon", "evening"] as const;

  return (
    <Card class="hub-card" onClick={handleTap}>
      <div class="hub-card-header">
        <span class="hub-card-title">Привычки</span>
        <span class="hub-card-badge">{progress.completed}/{progress.total}</span>
      </div>
      <div class="hub-habits-progress">
        <div class="hub-habits-fill" style={{ width: `${pct}%` }} />
      </div>
      <div class="hub-habits-dots">
        {slots.map((slot) => {
          const habits = data[slot];
          if (habits.length === 0) return null;
          return (
            <span key={slot}>
              {SLOT_EMOJI[slot]}{" "}
              {habits.map((h) => (h.completedToday ? "●" : "○")).join("")}
            </span>
          );
        })}
      </div>
      <div class="hub-habits-stats">
        <span>🔥 {maxStreak} дней</span>
        <span>📊 {avgConsistency}%</span>
      </div>
    </Card>
  );
}
