import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { habitsData, habitsLoading, habitsError, todayProgress, loadHabits } from "../../store/habits";
import { DayProgress } from "./DayProgress";
import { WeekHeatmap } from "./WeekHeatmap";
import { RoutineGroup } from "./RoutineGroup";
import { HabitCreate } from "./HabitCreate";
import { HabitDetail } from "./HabitDetail";
import { MilestoneToast } from "./MilestoneToast";
import { CorrelationCard } from "./CorrelationCard";
import { navigate } from "../../router";
import type { HabitData } from "../../api/types";

// Store suggest param from bot deep link for Task 12
export const suggestedHabit = signal<string | null>(null);
const showCreate = signal(false);
const selectedHabit = signal<HabitData | null>(null);
const milestoneMessage = signal<string | null>(null);
const showConfetti = signal(false);

function parseSuggestParam() {
  const params = new URLSearchParams(window.location.search);
  const suggest = params.get("suggest");
  if (suggest) {
    suggestedHabit.value = suggest;
  }
}

const CONFETTI_COLORS = [
  "#4CAF50", "#8BC34A", "#FFC107", "#FF9800",
  "#03A9F4", "#9C27B0", "#E91E63", "#F44336",
];

function Confetti() {
  const pieces = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div class="confetti-container">
      {pieces.map((i) => (
        <div
          key={i}
          class="confetti-piece"
          style={{
            left: `${10 + (i / 14) * 80}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 5) * 0.1}s`,
            animationDuration: `${1.2 + (i % 4) * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

function getMilestoneMessage(streak: number): string | null {
  if (streak === 7) return "🎉 Неделя! Нейронная связь формируется";
  if (streak === 21) return "🌿 21 день! Привычка укрепляется";
  if (streak === 60) return "🌳 60 дней! Это теперь часть тебя";
  return null;
}

function handleHabitCompleted(completedHabit: HabitData) {
  // After loadHabits() the store is refreshed — check streak from data
  const data = habitsData.value;
  if (!data) return;

  const allHabits = [...data.morning, ...data.afternoon, ...data.evening];
  const fresh = allHabits.find(h => h.id === completedHabit.id);
  const streak = fresh ? fresh.streakCurrent : completedHabit.streakCurrent;

  // Milestone check
  const msg = getMilestoneMessage(streak);
  if (msg) {
    milestoneMessage.value = msg;
    showConfetti.value = true;
    setTimeout(() => { showConfetti.value = false; }, 1600);
    return;
  }

  // All-done confetti (no milestone)
  const allDone = allHabits.length > 0 && allHabits.every(h => h.completedToday);
  if (allDone) {
    showConfetti.value = true;
    setTimeout(() => { showConfetti.value = false; }, 1600);
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
      {showConfetti.value && <Confetti />}

      {milestoneMessage.value && (
        <MilestoneToast
          message={milestoneMessage.value}
          onDismiss={() => { milestoneMessage.value = null; }}
        />
      )}

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
          <RoutineGroup slot="morning" habits={data!.morning} onOpenDetail={(h) => { selectedHabit.value = h; }} onCompleted={handleHabitCompleted} />
          <RoutineGroup slot="afternoon" habits={data!.afternoon} onOpenDetail={(h) => { selectedHabit.value = h; }} onCompleted={handleHabitCompleted} />
          <RoutineGroup slot="evening" habits={data!.evening} onOpenDetail={(h) => { selectedHabit.value = h; }} onCompleted={handleHabitCompleted} />
        </>
      )}

      {!isEmpty && allHabits.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          {allHabits.map((h) => (
            <CorrelationCard key={h.id} habitId={h.id} />
          ))}
        </div>
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
