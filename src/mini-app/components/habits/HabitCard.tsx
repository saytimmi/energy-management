import { useState, useRef } from "preact/hooks";
import type { HabitData } from "../../api/types";
import { toggleComplete } from "../../store/habits";
import { haptic } from "../../telegram";

interface HabitCardProps {
  habit: HabitData;
  onOpenDetail?: (habit: HabitData) => void;
  onCompleted?: (habit: HabitData) => void;
}

// Gradient colors based on life area
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

export function HabitCard({ habit, onOpenDetail, onCompleted }: HabitCardProps) {
  const done = habit.completedToday;
  const [completing, setCompleting] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  async function handleComplete() {
    haptic("medium");
    if (!done) {
      setCompleting(true);
      await toggleComplete(habit);
      setCompleting(false);
      if (onCompleted) onCompleted(habit);
    } else {
      await toggleComplete(habit);
    }
  }

  function onTouchStart() {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      haptic("heavy");
      if (onOpenDetail) onOpenDetail(habit);
    }, 500);
  }

  function onTouchEnd(e: Event) {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (didLongPress.current) {
      e.preventDefault();
      return;
    }
    handleComplete();
  }

  function onTouchMove() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  const iconGradient = done ? DONE_GRADIENT : (AREA_GRADIENTS[habit.lifeArea ?? ""] ?? DEFAULT_GRADIENT);

  return (
    <div
      class={`habit-card-v2${done ? " completed" : ""} ${completing ? "completing-card" : ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onMouseUp={(e) => { if (!didLongPress.current) handleComplete(); }}
    >
      {/* Icon with gradient background */}
      <div class="habit-icon-wrap" style={{ background: iconGradient }}>
        {done ? (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M5 11l4.5 4.5 8-9.5" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
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
          {habit.streakCurrent > 0 && (
            <span class="habit-streak-pill">
              <span class="streak-fire">🔥</span> {habit.streakCurrent}д
            </span>
          )}
          {habit.stage === "growth" && <span class="habit-stage-pill">🌿</span>}
          {habit.stage === "autopilot" && <span class="habit-stage-pill">🌳</span>}
        </div>
      </div>

      {/* Detail arrow */}
      <button
        class="habit-detail-arrow"
        onClick={(e) => {
          e.stopPropagation();
          haptic("light");
          if (onOpenDetail) onOpenDetail(habit);
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M7 13l4-4-4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
