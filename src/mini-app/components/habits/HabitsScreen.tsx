import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { habitsData, habitsLoading, habitsError, todayProgress, loadHabits } from "../../store/habits";
import { DayProgress } from "./DayProgress";
import { WeekHeatmap } from "./WeekHeatmap";
import { RoutineGroup } from "./RoutineGroup";
import { navigate } from "../../router";

// Store suggest param from bot deep link for Task 12
export const suggestedHabit = signal<string | null>(null);

function parseSuggestParam() {
  const params = new URLSearchParams(window.location.search);
  const suggest = params.get("suggest");
  if (suggest) {
    suggestedHabit.value = suggest;
  }
}

export function HabitsScreen() {
  useEffect(() => {
    parseSuggestParam();
    loadHabits();
  }, []);

  if (habitsLoading.value && !habitsData.value) {
    return (
      <div class="screen loading-screen">
        <div class="pulse-ring" />
        <p class="loading-text">Загружаю привычки...</p>
      </div>
    );
  }

  if (habitsError.value && !habitsData.value) {
    return (
      <div class="screen" style={{ display: "flex", flexDirection: "column" }}>
        <div class="welcome-content">
          <div class="welcome-icon">😔</div>
          <h1>Не удалось загрузить</h1>
          <p>Проверь соединение и попробуй снова</p>
          <button class="retry-btn" onClick={() => loadHabits()}>🔄 Повторить</button>
        </div>
      </div>
    );
  }

  const data = habitsData.value;
  const progress = todayProgress.value;
  const isEmpty = !data || (data.morning.length === 0 && data.afternoon.length === 0 && data.evening.length === 0);

  // Compute overall streak and consistency from all habits
  const allHabits = data ? [...data.morning, ...data.afternoon, ...data.evening] : [];
  const maxStreak = allHabits.reduce((max, h) => Math.max(max, h.streakCurrent), 0);
  const avgConsistency = allHabits.length > 0
    ? Math.round(allHabits.reduce((sum, h) => sum + h.consistency30d, 0) / allHabits.length)
    : 0;

  return (
    <div class="habits-screen" style={{ paddingBottom: "calc(var(--nav-h) + 20px)" }}>
      <DayProgress
        completed={progress.completed}
        total={progress.total}
        streak={maxStreak}
        consistency={avgConsistency}
      />

      <WeekHeatmap />

      {isEmpty ? (
        <div class="habits-empty">
          <p style={{ fontSize: "32px", marginBottom: "12px" }}>🌱</p>
          <p>Ещё нет привычек. Создай первую!</p>
        </div>
      ) : (
        <>
          <RoutineGroup slot="morning" habits={data!.morning} />
          <RoutineGroup slot="afternoon" habits={data!.afternoon} />
          <RoutineGroup slot="evening" habits={data!.evening} />
        </>
      )}

      <button class="add-habit-btn" onClick={() => navigate("habits")}>
        + Добавить привычку
      </button>
    </div>
  );
}
