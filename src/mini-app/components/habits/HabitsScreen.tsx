import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { habitsData, habitsLoading, habitsError, todayProgress, loadHabits } from "../../store/habits";
import { DayProgress } from "./DayProgress";
import { WeekHeatmap } from "./WeekHeatmap";
import { RoutineGroup } from "./RoutineGroup";
import { RoutineFlow } from "./RoutineFlow";
import { HabitCreate } from "./HabitCreate";
import { HabitDetail } from "./HabitDetail";
import { MilestoneToast } from "./MilestoneToast";
import { Skeleton, SkeletonCard } from "../shared/Skeleton";
import { haptic } from "../../telegram";
import type { HabitData } from "../../api/types";

export const suggestedHabit = signal<string | null>(null);
const showCreate = signal(false);
const selectedHabit = signal<HabitData | null>(null);
const milestoneMessage = signal<string | null>(null);
const showConfetti = signal(false);
const routineFlowSlot = signal<string | null>(null);

function parseSuggestParam() {
  const params = new URLSearchParams(window.location.search);
  const suggest = params.get("suggest");
  if (suggest) suggestedHabit.value = suggest;
}

const CONFETTI_COLORS = [
  "#c8ff73", "#5be07a", "#5ba8ff", "#c77dff",
  "#ff8c5b", "#FFC107", "#03A9F4", "#E91E63",
];

function Confetti() {
  return (
    <div class="confetti-container">
      {Array.from({ length: 16 }, (_, i) => (
        <div
          key={i}
          class="confetti-piece"
          style={{
            left: `${8 + (i / 16) * 84}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 5) * 0.08}s`,
            animationDuration: `${1.1 + (i % 4) * 0.12}s`,
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
  const data = habitsData.value;
  if (!data) return;

  const allHabits = [...data.morning, ...data.afternoon, ...data.evening];
  const fresh = allHabits.find(h => h.id === completedHabit.id);
  const streak = fresh ? fresh.streakCurrent : completedHabit.streakCurrent;

  const msg = getMilestoneMessage(streak);
  if (msg) {
    milestoneMessage.value = msg;
    showConfetti.value = true;
    setTimeout(() => { showConfetti.value = false; }, 1600);
    return;
  }

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

  // Routine Flow mode
  if (routineFlowSlot.value && data) {
    const slotHabits = data[routineFlowSlot.value as keyof typeof data] ?? [];
    const slotLabels: Record<string, string> = {
      morning: "🌅 Утренняя рутина",
      afternoon: "☀️ Дневная рутина",
      evening: "🌙 Вечерняя рутина",
    };
    return (
      <RoutineFlow
        habits={slotHabits}
        slotLabel={slotLabels[routineFlowSlot.value] ?? "Рутина"}
        onFinish={() => { routineFlowSlot.value = null; loadHabits(); }}
      />
    );
  }

  if (selectedHabit.value) {
    return (
      <HabitDetail
        habit={selectedHabit.value}
        onBack={() => { selectedHabit.value = null; loadHabits(); }}
      />
    );
  }

  if (showCreate.value) {
    return (
      <HabitCreate
        onClose={(createdHabit) => {
          showCreate.value = false;
          if (createdHabit) {
            loadHabits();
          }
        }}
        microActionId={suggestedHabit.value}
      />
    );
  }

  if (habitsLoading.value && !habitsData.value) {
    return (
      <div class="habits-screen">
        <SkeletonCard style={{ marginBottom: "12px" }}>
          <Skeleton width="40%" height="24px" style={{ marginBottom: "8px" }} />
          <Skeleton width="100%" height="8px" radius="4px" />
        </SkeletonCard>
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} style={{ marginBottom: "10px" }} />
        ))}
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
          <button class="retry-btn" onClick={() => loadHabits()}>Повторить</button>
        </div>
      </div>
    );
  }

  const data = habitsData.value;
  const progress = todayProgress.value;
  const isEmpty = !data || (data.morning.length === 0 && data.afternoon.length === 0 && data.evening.length === 0);

  const allHabits = data ? [...data.morning, ...data.afternoon, ...data.evening] : [];
  const maxStreak = allHabits.reduce((max, h) => Math.max(max, h.streakCurrent), 0);
  const avgConsistency = allHabits.length > 0
    ? Math.round(allHabits.reduce((sum, h) => sum + h.consistency30d, 0) / allHabits.length)
    : 0;

  return (
    <div class="habits-screen">
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
        <div class="habits-empty-state">
          <div class="habits-empty-icon">🌱</div>
          <h3>Начни с одной привычки</h3>
          <p>Тап на + внизу. Бот поможет выбрать, что подходит именно тебе.</p>
        </div>
      ) : (
        <>
          <RoutineGroup slot="morning" habits={data!.morning} onOpenDetail={(h) => { selectedHabit.value = h; }} onCompleted={handleHabitCompleted} onStartRoutine={(s) => { routineFlowSlot.value = s; }} />
          <RoutineGroup slot="afternoon" habits={data!.afternoon} onOpenDetail={(h) => { selectedHabit.value = h; }} onCompleted={handleHabitCompleted} onStartRoutine={(s) => { routineFlowSlot.value = s; }} />
          <RoutineGroup slot="evening" habits={data!.evening} onOpenDetail={(h) => { selectedHabit.value = h; }} onCompleted={handleHabitCompleted} onStartRoutine={(s) => { routineFlowSlot.value = s; }} />
        </>
      )}

      {/* FAB — floating add button */}
      <button class="habit-fab" onClick={() => { haptic("medium"); showCreate.value = true; }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  );
}
