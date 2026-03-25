import { useState, useEffect } from "preact/hooks";
import type { HabitData } from "../../api/types";
import { toggleComplete, startDurationHabit } from "../../store/habits";
import { haptic } from "../../telegram";

interface HabitCardProps {
  habit: HabitData;
  onOpenDetail?: (habit: HabitData) => void;
  onCompleted?: (habit: HabitData) => void;
}

const AREA_GRADIENTS: Record<string, string> = {
  health:        "linear-gradient(135deg, rgba(91,224,122,0.2), rgba(91,224,122,0.08))",
  career:        "linear-gradient(135deg, rgba(91,168,255,0.2), rgba(91,168,255,0.08))",
  relationships: "linear-gradient(135deg, rgba(255,140,91,0.2), rgba(255,140,91,0.08))",
  finances:      "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.08))",
  family:        "linear-gradient(135deg, rgba(255,140,91,0.2), rgba(255,140,91,0.08))",
  growth:        "linear-gradient(135deg, rgba(199,125,255,0.2), rgba(199,125,255,0.08))",
  recreation:    "linear-gradient(135deg, rgba(91,168,255,0.15), rgba(199,125,255,0.08))",
  environment:   "linear-gradient(135deg, rgba(91,224,122,0.15), rgba(91,168,255,0.08))",
};

const DEFAULT_GRADIENT = "linear-gradient(135deg, rgba(200,255,115,0.12), rgba(200,255,115,0.04))";
const DONE_GRADIENT = "linear-gradient(135deg, rgba(200,255,115,0.25), rgba(200,255,115,0.1))";
const PROGRESS_GRADIENT = "linear-gradient(135deg, rgba(91,168,255,0.25), rgba(91,168,255,0.1))";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}м`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
}

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - start) / 60000);
  if (diffMin < 60) return `${diffMin}м`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
}

export function HabitCard({ habit, onOpenDetail, onCompleted }: HabitCardProps) {
  const done = habit.completedToday;
  const inProgress = habit.inProgress;
  const isDuration = habit.isDuration;
  const [completing, setCompleting] = useState(false);
  const [elapsed, setElapsed] = useState("");

  // Update elapsed timer for in-progress duration habits
  useEffect(() => {
    if (!inProgress || !habit.startedAt) return;
    setElapsed(formatElapsed(habit.startedAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(habit.startedAt!));
    }, 30000);
    return () => clearInterval(interval);
  }, [inProgress, habit.startedAt]);

  // Tap on icon = toggle complete (with debounce)
  async function handleIconTap(e: Event) {
    e.stopPropagation();
    if (completing) return; // debounce

    if (isDuration && !done && !inProgress) {
      haptic("medium");
      await startDurationHabit(habit);
      return;
    }

    if (isDuration && inProgress) {
      haptic("medium");
      setCompleting(true);
      await toggleComplete(habit);
      setCompleting(false);
      if (onCompleted) onCompleted(habit);
      return;
    }

    // Instant or undo
    haptic("medium");
    setCompleting(true);
    const now = new Date();
    const timeStr = done ? undefined : `в ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await toggleComplete(habit, timeStr);
    setCompleting(false);
    if (!done && onCompleted) onCompleted(habit);
  }

  // Tap on card body = open detail
  function handleCardTap() {
    if (onOpenDetail) {
      haptic("light");
      onOpenDetail(habit);
    }
  }

  const isPaused = habit.isPaused;

  const iconGradient = isPaused
    ? "linear-gradient(135deg, rgba(128,128,128,0.15), rgba(128,128,128,0.05))"
    : done
      ? DONE_GRADIENT
      : inProgress
        ? PROGRESS_GRADIENT
        : (AREA_GRADIENTS[habit.lifeArea ?? ""] ?? DEFAULT_GRADIENT);

  // Status label
  let statusLabel: string | null = null;
  if (isDuration && inProgress && elapsed) {
    statusLabel = elapsed;
  } else if (isDuration && !done && !inProgress) {
    statusLabel = habit.duration ? formatDuration(habit.duration) : "На время";
  } else if (!isDuration && !done && habit.duration) {
    statusLabel = formatDuration(habit.duration);
  }

  return (
    <div
      class={`habit-card-v2${done ? " completed" : ""}${inProgress ? " in-progress" : ""}${isPaused ? " paused" : ""} ${completing ? `completing-card completing-${habit.stage}` : ""}`}
      onClick={isPaused ? undefined : handleCardTap}
    >
      {/* Icon — tap to complete */}
      <div
        class="habit-icon-wrap"
        style={{ background: iconGradient }}
        onClick={isPaused ? undefined : handleIconTap}
        onTouchEnd={isPaused ? undefined : (e) => { e.stopPropagation(); }}
      >
        {done ? (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M5 11l4.5 4.5 8-9.5" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        ) : inProgress ? (
          <div class="habit-pulse-dot" />
        ) : (
          <span class="habit-icon-emoji">{habit.icon}</span>
        )}
      </div>

      {/* Info */}
      <div class="habit-card-info">
        <span class={`habit-card-name${done ? " done" : ""}`}>
          {habit.name}
        </span>
        <div class="habit-card-meta">
          {inProgress && statusLabel && (
            <span class="habit-timer-pill">{statusLabel}</span>
          )}
          {!inProgress && !done && statusLabel && (
            <span class="habit-duration-pill">{statusLabel}</span>
          )}
          {habit.streakCurrent > 0 && (
            <span class="habit-streak-pill">
              <span class="streak-fire">🔥</span> {habit.streakCurrent}д
            </span>
          )}
          {habit.stage === "growth" && <span class="habit-stage-pill">🌿</span>}
          {habit.stage === "autopilot" && <span class="habit-stage-pill">🌳</span>}
          {isPaused && <span class="habit-paused-pill">⏸</span>}
        </div>
      </div>

      {/* Action buttons */}
      {isDuration && !done && !inProgress ? (
        <button class="habit-start-btn" onClick={(e) => { e.stopPropagation(); haptic("medium"); startDurationHabit(habit); }}
          onTouchEnd={(e) => e.stopPropagation()}>
          Начать
        </button>
      ) : isDuration && inProgress ? (
        <button class="habit-finish-btn" onClick={(e) => { e.stopPropagation(); handleIconTap(e); }}
          onTouchEnd={(e) => e.stopPropagation()}>
          Готово
        </button>
      ) : (
        <button
          class="habit-detail-arrow"
          onClick={(e) => { e.stopPropagation(); haptic("light"); if (onOpenDetail) onOpenDetail(habit); }}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 13l4-4-4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}
