import type { HabitData } from "../../api/types";
import { toggleComplete } from "../../store/habits";
import { haptic } from "../../telegram";

interface HabitCardProps {
  habit: HabitData;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 1) return `${Math.round(minutes * 60)}с`;
  return `${minutes}м`;
}

export function HabitCard({ habit }: HabitCardProps) {
  const done = habit.completedToday;

  function handleTap() {
    haptic("medium");
    toggleComplete(habit);
  }

  return (
    <div class="habit-card" onClick={handleTap}>
      <div class={`habit-check ${done ? "done" : ""}`}>
        {done && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7l3 3 5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        )}
      </div>
      <div class="habit-info">
        <div class="habit-name" style={done ? { opacity: 0.5, textDecoration: "line-through" } : {}}>
          {habit.icon} {habit.name}
        </div>
      </div>
      {habit.duration != null && habit.duration > 0 && (
        <span class="habit-duration">{formatDuration(habit.duration)}</span>
      )}
    </div>
  );
}
