import type { HabitData } from "../../api/types";
import { HabitCard } from "./HabitCard";
import { haptic } from "../../telegram";

interface RoutineGroupProps {
  slot: "morning" | "afternoon" | "evening";
  habits: HabitData[];
  onOpenDetail?: (habit: HabitData) => void;
  onCompleted?: (habit: HabitData) => void;
  onStartRoutine?: (slot: string) => void;
}

const SLOT_LABELS: Record<string, string> = {
  morning: "УТРО",
  afternoon: "ДЕНЬ",
  evening: "ВЕЧЕР",
};

export function RoutineGroup({ slot, habits, onOpenDetail, onCompleted, onStartRoutine }: RoutineGroupProps) {
  if (habits.length === 0) return null;

  const pending = habits.filter(h => !h.completedToday && !h.isPaused);
  const allDone = pending.length === 0;

  return (
    <div class="routine-group">
      <div class="routine-header">
        <span>{SLOT_LABELS[slot]}</span>
        {!allDone && habits.length >= 2 && onStartRoutine && (
          <button
            class="routine-start-btn"
            onClick={() => { haptic("medium"); onStartRoutine(slot); }}
          >
            ▶ Рутина
          </button>
        )}
      </div>
      {habits.map((h) => (
        <HabitCard key={h.id} habit={h} onOpenDetail={onOpenDetail} onCompleted={onCompleted} />
      ))}
    </div>
  );
}
