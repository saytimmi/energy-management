import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { api } from "../../api/client";
import type { HabitCorrelation } from "../../api/types";

interface CorrelationCardProps {
  habitId: number;
}

const ENERGY_LABELS: Record<string, string> = {
  physical: "Физическая",
  mental: "Ментальная",
  emotional: "Эмоциональная",
  spiritual: "Духовная",
};

const cache = new Map<number, HabitCorrelation>();

export function CorrelationCard({ habitId }: CorrelationCardProps) {
  const data = signal<HabitCorrelation | null>(cache.get(habitId) ?? null);
  const loading = signal(!cache.has(habitId));

  useEffect(() => {
    if (cache.has(habitId)) {
      data.value = cache.get(habitId)!;
      loading.value = false;
      return;
    }

    loading.value = true;
    api.habitCorrelation(habitId)
      .then((result) => {
        cache.set(habitId, result);
        data.value = result;
      })
      .catch((err) => {
        console.error("Failed to load correlation:", err);
      })
      .finally(() => {
        loading.value = false;
      });
  }, [habitId]);

  if (loading.value || !data.value || data.value.insufficient) {
    return null;
  }

  const correlation = data.value;
  const types = ["physical", "mental", "emotional", "spiritual"] as const;
  const significant = types.filter(
    (t) => Math.abs(correlation[t] ?? 0) > 0.5,
  );

  if (significant.length === 0) return null;

  return (
    <div class="correlation-card">
      <div class="correlation-title">
        Когда ты делаешь эту привычку:
      </div>
      <div class="correlation-items">
        {significant.map((type) => {
          const delta = correlation[type] ?? 0;
          const isPositive = delta > 0;
          return (
            <div key={type} class="correlation-item">
              <span class="correlation-label">{ENERGY_LABELS[type]}</span>
              <span class={`correlation-delta ${isPositive ? "correlation-positive" : "correlation-negative"}`}>
                {isPositive ? "+" : ""}{delta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
