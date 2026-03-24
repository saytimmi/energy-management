import { useState, useEffect, useRef } from "preact/hooks";
import type { HabitData } from "../../api/types";
import { toggleComplete, startDurationHabit } from "../../store/habits";
import { haptic, hapticSuccess } from "../../telegram";

interface RoutineFlowProps {
  habits: HabitData[];
  slotLabel: string;
  identityMap?: Record<string, string | null>;
  onFinish: () => void;
}

export function RoutineFlow({ habits, slotLabel, identityMap, onFinish }: RoutineFlowProps) {
  const pending = habits.filter(h => !h.completedToday && !h.isPaused);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [showIdentityIntro, setShowIdentityIntro] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const current = pending[currentIdx];

  // Identity for the first habit's lifeArea
  const firstHabitArea = pending[0]?.lifeArea;
  const identityText = firstHabitArea && identityMap ? identityMap[firstHabitArea] : null;

  // Timer
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - timer * 1000;
      intervalRef.current = setInterval(() => {
        setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Auto-start timer for duration habits
  useEffect(() => {
    if (current?.isDuration && !current.inProgress) {
      setTimer(0);
      setIsRunning(false);
    } else if (current?.isDuration && current.inProgress) {
      setIsRunning(true);
    } else {
      // Instant habit — start timer for tracking
      setTimer(0);
      setIsRunning(true);
    }
  }, [currentIdx]);

  function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  async function handleComplete() {
    if (!current || completing) return;
    setCompleting(true);

    if (current.isDuration && !current.inProgress) {
      // Start duration habit
      haptic("medium");
      await startDurationHabit(current);
      setIsRunning(true);
      setCompleting(false);
      return;
    }

    hapticSuccess();
    await toggleComplete(current);
    setTotalTime(t => t + timer);
    setCompletedCount(c => c + 1);
    setIsRunning(false);
    setCompleting(false);

    if (currentIdx + 1 >= pending.length) {
      setFinished(true);
    } else {
      setCurrentIdx(i => i + 1);
      setTimer(0);
    }
  }

  function handleSkip() {
    haptic("light");
    if (currentIdx + 1 >= pending.length) {
      setFinished(true);
    } else {
      setIsRunning(false);
      setTimer(0);
      setCurrentIdx(i => i + 1);
    }
  }

  // Identity intro screen — show before first habit
  if (showIdentityIntro && identityText && currentIdx === 0 && !finished) {
    return (
      <div class="routine-flow">
        <div class="routine-flow-header">
          <button class="routine-flow-close" onClick={onFinish}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <span class="routine-flow-title">{slotLabel}</span>
          <span class="routine-flow-count" />
        </div>
        <div class="routine-flow-identity-card">
          <div class="routine-flow-identity-mirror">🪞</div>
          <p class="routine-flow-identity-text">{identityText}</p>
          <button
            class="routine-flow-identity-btn"
            onClick={() => { haptic("medium"); setShowIdentityIntro(false); }}
          >
            Начать →
          </button>
        </div>
      </div>
    );
  }

  // Finished screen
  if (finished || pending.length === 0) {
    return (
      <div class="routine-flow">
        <div class="routine-flow-finish">
          <div class="routine-flow-finish-icon">🎉</div>
          <h2>{pending.length === 0 ? "Всё сделано!" : "Рутина завершена!"}</h2>
          {completedCount > 0 && (
            <p class="routine-flow-finish-stats">
              {completedCount} из {pending.length} · {Math.floor(totalTime / 60)} мин
            </p>
          )}
          <button class="routine-flow-done-btn" onClick={() => { hapticSuccess(); onFinish(); }}>
            Готово
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const progress = currentIdx / pending.length;

  return (
    <div class="routine-flow">
      {/* Header */}
      <div class="routine-flow-header">
        <button class="routine-flow-close" onClick={onFinish}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <span class="routine-flow-title">{slotLabel}</span>
        <span class="routine-flow-count">{currentIdx + 1}/{pending.length}</span>
      </div>

      {/* Progress bar */}
      <div class="routine-flow-progress">
        {pending.map((_, i) => (
          <div
            key={i}
            class={`routine-flow-step${i < currentIdx ? " done" : ""}${i === currentIdx ? " active" : ""}`}
          />
        ))}
      </div>

      {/* Current habit */}
      <div class="routine-flow-card">
        <div class="routine-flow-emoji">{current.icon}</div>
        <h3 class="routine-flow-name">{current.name}</h3>
        {current.whyToday && (
          <p class="routine-flow-why">{current.whyToday}</p>
        )}
        {current.duration && !current.isDuration && (
          <p class="routine-flow-duration">{current.duration} мин</p>
        )}
        {current.isDuration && !current.inProgress && (
          <p class="routine-flow-duration">{current.duration ? `${current.duration} мин` : "На время"}</p>
        )}

        {/* Timer */}
        <div class="routine-flow-timer">{formatTimer(timer)}</div>

        {/* Minimal dose hint */}
        {current.minimalDose && (
          <p class="routine-flow-minimal">💡 Минимум: {current.minimalDose}</p>
        )}
      </div>

      {/* Actions */}
      <div class="routine-flow-actions">
        <button class="routine-flow-skip" onClick={handleSkip}>⏭ Пропустить</button>
        <button
          class="routine-flow-complete"
          onClick={handleComplete}
          disabled={completing}
        >
          {current.isDuration && !current.inProgress
            ? "▶ Начать"
            : "✅ Готово → Далее"
          }
        </button>
      </div>
    </div>
  );
}
