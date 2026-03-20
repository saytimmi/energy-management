import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { habitsData, habitsLoading, habitsError, todayProgress, loadHabits } from "../../store/habits";
import { DayProgress } from "./DayProgress";
import { WeekHeatmap } from "./WeekHeatmap";
import { RoutineGroup } from "./RoutineGroup";
import { HabitCreate } from "./HabitCreate";
import { HabitDetail } from "./HabitDetail";
import { navigate } from "../../router";
import type { HabitData } from "../../api/types";

// Store suggest param from bot deep link for Task 12
export const suggestedHabit = signal<string | null>(null);
const showCreate = signal(false);
const selectedHabit = signal<HabitData | null>(null);

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

  if (selectedHabit.value) {
    return (
      <HabitDetail
        habit={selectedHabit.value}
        onBack={() => { selectedHabit.value = null; }}
      />
    );
  }

  if (showCreate.value) {
    return (
      <HabitCreate
        onClose={() => { showCreate.value = false; }}
        microActionId={suggestedHabit.value}
      />
    );
  }

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

  // Slot limit: count seed + growth habits
  const activeGrowing = allHabits.filter(h => h.stage === "seed" || h.stage === "growth").length;
  const slotLimitReached = activeGrowing >= 3;

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
          <RoutineGroup slot="morning" habits={data!.morning} onOpenDetail={(h) => { selectedHabit.value = h; }} />
          <RoutineGroup slot="afternoon" habits={data!.afternoon} onOpenDetail={(h) => { selectedHabit.value = h; }} />
          <RoutineGroup slot="evening" habits={data!.evening} onOpenDetail={(h) => { selectedHabit.value = h; }} />
        </>
      )}

      {slotLimitReached ? (
        <button class="add-habit-btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
          3 привычки растут. Доведи до автопилота 🌳 или архивируй
        </button>
      ) : (
        <button class="add-habit-btn" onClick={() => { showCreate.value = true; }}>
          + Добавить привычку
        </button>
      )}
    </div>
  );
}
