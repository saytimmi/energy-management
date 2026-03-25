import { signal, computed } from "@preact/signals";
import { api } from "../api/client";
import type { HabitData, HabitsGrouped, CreateHabitPayload } from "../api/types";

export const habitsData = signal<HabitsGrouped | null>(null);
export const habitsLoading = signal(false);
export const habitsError = signal(false);

let lastFetchedAt = 0;
const CACHE_TTL = 30_000;

export const todayProgress = computed(() => {
  if (!habitsData.value) return { completed: 0, total: 0 };
  const all = [...habitsData.value.morning, ...habitsData.value.afternoon, ...habitsData.value.evening];
  return {
    completed: all.filter(h => h.completedToday).length,
    total: all.length,
  };
});

export async function loadHabits(force = false): Promise<void> {
  const now = Date.now();
  if (!force && lastFetchedAt && now - lastFetchedAt < CACHE_TTL && habitsData.value) return;

  // Only show spinner on first load
  if (!habitsData.value) habitsLoading.value = true;
  habitsError.value = false;
  try {
    habitsData.value = await api.habits();
    lastFetchedAt = Date.now();
  } catch {
    habitsError.value = true;
  } finally {
    habitsLoading.value = false;
  }
}

/** Optimistically update a habit in local state */
function optimisticUpdate(habitId: number, patch: Partial<HabitData>): void {
  if (!habitsData.value) return;
  const update = (list: HabitData[]) =>
    list.map(h => h.id === habitId ? { ...h, ...patch } : h);
  habitsData.value = {
    morning: update(habitsData.value.morning),
    afternoon: update(habitsData.value.afternoon),
    evening: update(habitsData.value.evening),
  };
}

export async function startDurationHabit(habit: HabitData): Promise<void> {
  optimisticUpdate(habit.id, { inProgress: true, startedAt: new Date().toISOString() });
  try {
    await api.startHabit(habit.id);
    loadHabits(true);
  } catch (err) {
    console.error("Failed to start habit:", err);
    optimisticUpdate(habit.id, { inProgress: false, startedAt: null });
  }
}

export async function toggleComplete(habit: HabitData, note?: string): Promise<void> {
  const wasCompleted = habit.completedToday;

  optimisticUpdate(habit.id, {
    completedToday: !wasCompleted,
    inProgress: false,
    streakCurrent: wasCompleted ? Math.max(0, habit.streakCurrent - 1) : habit.streakCurrent + 1,
  });

  try {
    if (wasCompleted) {
      await api.uncompleteHabit(habit.id);
    } else {
      await api.completeHabit(habit.id, note);
    }
    loadHabits(true);
  } catch (err) {
    console.error("Failed to toggle habit:", err);
    optimisticUpdate(habit.id, {
      completedToday: wasCompleted,
      inProgress: habit.inProgress,
      streakCurrent: habit.streakCurrent,
    });
  }
}

export async function createHabit(data: CreateHabitPayload): Promise<HabitData | null> {
  try {
    const habit = await api.createHabit(data);
    await loadHabits(true);
    return habit;
  } catch (err) {
    console.error("Failed to create habit:", err);
    return null;
  }
}

export async function deleteHabit(id: number): Promise<boolean> {
  try {
    await api.deleteHabit(id);
    await loadHabits(true);
    return true;
  } catch (err) {
    console.error("Failed to delete habit:", err);
    return false;
  }
}

export async function updateHabit(id: number, data: Partial<CreateHabitPayload>): Promise<HabitData | null> {
  try {
    const habit = await api.updateHabit(id, data);
    await loadHabits(true);
    return habit;
  } catch (err) {
    console.error("Failed to update habit:", err);
    return null;
  }
}

export async function pauseHabit(id: number, days: number): Promise<boolean> {
  try {
    await api.pauseHabit(id, days);
    await loadHabits(true);
    return true;
  } catch (err) {
    console.error("Failed to pause habit:", err);
    return false;
  }
}

export async function resumeHabit(id: number): Promise<boolean> {
  try {
    await api.resumeHabit(id);
    await loadHabits(true);
    return true;
  } catch (err) {
    console.error("Failed to resume habit:", err);
    return false;
  }
}
