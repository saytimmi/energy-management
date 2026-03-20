import type { HabitData } from "../../api/types";
import { HabitCard } from "./HabitCard";

interface RoutineGroupProps {
  slot: "morning" | "afternoon" | "evening";
  habits: HabitData[];
}

const SLOT_LABELS: Record<string, string> = {
  morning: "☀️ Утро",
  afternoon: "🌤 День",
  evening: "🌙 Вечер",
};

export function RoutineGroup({ slot, habits }: RoutineGroupProps) {
  if (habits.length === 0) return null;

  return (
    <div class="routine-group">
      <div class="routine-header">{SLOT_LABELS[slot]}</div>
      {habits.map((h) => (
        <HabitCard key={h.id} habit={h} />
      ))}
    </div>
  );
}
