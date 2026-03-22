import { useState } from "preact/hooks";
import type { HabitData } from "../../api/types";
import { toggleComplete } from "../../store/habits";
import { haptic } from "../../telegram";

interface HabitCardProps {
  habit: HabitData;
  onOpenDetail?: (habit: HabitData) => void;
  onCompleted?: (habit: HabitData) => void;
}

export function HabitCard({ habit, onOpenDetail, onCompleted }: HabitCardProps) {
  const done = habit.completedToday;
  const [completing, setCompleting] = useState(false);

  async function handleCheck(e: Event) {
    e.stopPropagation();
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

  function handleTap() {
    if (onOpenDetail) {
      haptic("light");
      onOpenDetail(habit);
    }
  }

  // Ring SVG for completion
  const ringSize = 40;
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div class={`habit-card-v2${done ? " completed" : ""}`} onClick={handleTap}>
      {/* Completion ring */}
      <div
        class={`habit-ring ${done ? "done" : ""} ${completing ? "completing" : ""}`}
        onClick={handleCheck}
      >
        <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          {/* Background circle */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="var(--surface2, #e0e0e0)"
            stroke-width={strokeWidth}
          />
          {/* Progress circle (full when done) */}
          {done && (
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="var(--accent, #4CAF50)"
              stroke-width={strokeWidth}
              stroke-dasharray={circumference}
              stroke-dashoffset="0"
              stroke-linecap="round"
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              class="habit-ring-fill"
            />
          )}
        </svg>
        {/* Center content */}
        <div class="habit-ring-center">
          {done ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 8l3.5 3.5 6-7" stroke="var(--accent, #4CAF50)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          ) : (
            <span class="habit-ring-icon">{habit.icon}</span>
          )}
        </div>
      </div>

      {/* Info */}
      <div class="habit-card-info">
        <span class={`habit-card-name${done ? " done" : ""}`}>
          {habit.name}
        </span>
        <div class="habit-card-meta">
          {habit.streakCurrent > 0 && (
            <span class="habit-streak-badge">🔥 {habit.streakCurrent}</span>
          )}
          {habit.duration != null && habit.duration > 0 && (
            <span class="habit-card-duration">{habit.duration}м</span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <svg class="habit-card-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
      </svg>
    </div>
  );
}
