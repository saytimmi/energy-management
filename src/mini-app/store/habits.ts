import { signal, computed } from "@preact/signals";
import { api } from "../api/client";
import type { HabitData, HabitsGrouped, CreateHabitPayload } from "../api/types";

export const habitsData = signal<HabitsGrouped | null>(null);
export const habitsLoading = signal(false);
export const habitsError = signal(false);

export const todayProgress = computed(() => {
  if (!habitsData.value) return { completed: 0, total: 0 };
  const all = [...habitsData.value.morning, ...habitsData.value.afternoon, ...habitsData.value.evening];
  return {
    completed: all.filter(h => h.completedToday).length,
    total: all.length,
  };
});

export async function loadHabits(): Promise<void> {
  habitsLoading.value = true;
  habitsError.value = false;
  try {
    habitsData.value = await api.habits();
  } catch {
    habitsError.value = true;
  } finally {
    habitsLoading.value = false;
  }
}

export async function startDurationHabit(habit: HabitData): Promise<void> {
  try {
    await api.startHabit(habit.id);
    await loadHabits();
  } catch (err) {
    console.error("Failed to start habit:", err);
  }
}

export async function toggleComplete(habit: HabitData, note?: string): Promise<void> {
  try {
    if (habit.completedToday) {
      await api.uncompleteHabit(habit.id);
    } else {
      await api.completeHabit(habit.id, note);
    }
    await loadHabits(); // refresh
  } catch (err) {
    console.error("Failed to toggle habit:", err);
  }
}

export async function createHabit(data: CreateHabitPayload): Promise<HabitData | null> {
  try {
    const habit = await api.createHabit(data);
    await loadHabits(); // refresh
    return habit;
  } catch (err) {
    console.error("Failed to create habit:", err);
    return null;
  }
}

export async function updateHabit(id: number, data: Partial<CreateHabitPayload>): Promise<HabitData | null> {
  try {
    const habit = await api.updateHabit(id, data);
    await loadHabits(); // refresh
    return habit;
  } catch (err) {
    console.error("Failed to update habit:", err);
    return null;
  }
}
