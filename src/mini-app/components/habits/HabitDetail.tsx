import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import type { HabitData, HabitStats } from "../../api/types";
import { api } from "../../api/client";
import { haptic } from "../../telegram";
import { StageIndicator } from "./StageIndicator";
import { CorrelationCard } from "./CorrelationCard";

interface HabitDetailProps {
  habit: HabitData;
  onBack: () => void;
}

const stats = signal<HabitStats | null>(null);
const statsLoading = signal(true);

export function HabitDetail({ habit, onBack }: HabitDetailProps) {
  useEffect(() => {
    statsLoading.value = true;
    stats.value = null;
    api.habitStats(habit.id)
      .then((data) => { stats.value = data; })
      .catch((err) => { console.error("Failed to load habit stats:", err); })
      .finally(() => { statsLoading.value = false; });
  }, [habit.id]);

  function handleBack() {
    haptic("light");
    onBack();
  }

  const s = stats.value;
  const isBuild = habit.type === "build";

  return (
    <div class="habit-detail">
      <div class="habit-detail-header">
        <button class="habit-detail-back" onClick={handleBack}>←</button>
        <div class="habit-detail-name">{habit.icon} {habit.name}</div>
      </div>

      <StageIndicator stage={habit.stage} createdAt={habit.createdAt} />

      <div class="detail-stats">
        <div>🔥 {s?.streakCurrent ?? habit.streakCurrent} дней (лучший: {s?.streakBest ?? habit.streakBest})</div>
        <div>📊 {s?.consistency30d ?? habit.consistency30d}% за месяц</div>
        <div>❄️ {s?.freezesRemaining ?? (1 - habit.freezesUsedThisWeek)} freeze осталось</div>
      </div>

      <div class="detail-section-title">Зачем</div>
      <div class="detail-why">
        {isBuild ? (
          <>
            {habit.whyToday && (
              <div class="detail-why-item">
                <div class="detail-why-label">Сегодня</div>
                <div>{habit.whyToday}</div>
              </div>
            )}
            {habit.whyMonth && (
              <div class="detail-why-item">
                <div class="detail-why-label">Месяц</div>
                <div>{habit.whyMonth}</div>
              </div>
            )}
            {habit.whyYear && (
              <div class="detail-why-item">
                <div class="detail-why-label">Год</div>
                <div>{habit.whyYear}</div>
              </div>
            )}
            {habit.whyIdentity && (
              <div class="detail-why-item">
                <div class="detail-why-label">Идентичность</div>
                <div>{habit.whyIdentity}</div>
              </div>
            )}
          </>
        ) : (
          <>
            {habit.isItBeneficial && (
              <div class="detail-why-item">
                <div class="detail-why-label">Польза привычки?</div>
                <div>{habit.isItBeneficial}</div>
              </div>
            )}
            {habit.breakTrigger && (
              <div class="detail-why-item">
                <div class="detail-why-label">Триггер</div>
                <div>{habit.breakTrigger}</div>
              </div>
            )}
            {habit.replacement && (
              <div class="detail-why-item">
                <div class="detail-why-label">Замена</div>
                <div>{habit.replacement}</div>
              </div>
            )}
          </>
        )}
        {!hasAnyWhy(habit) && (
          <div class="detail-why-item" style={{ opacity: 0.5 }}>Не заполнено</div>
        )}
        <button
          class="create-next-btn"
          disabled
          style={{ marginTop: "12px", opacity: 0.4, fontSize: "14px", padding: "10px" }}
        >
          ✏️ Обновить
        </button>
      </div>

      <div class="detail-section-title">Месяц</div>
      {statsLoading.value ? (
        <div style={{ textAlign: "center", padding: "20px", opacity: 0.5 }}>Загрузка...</div>
      ) : s?.heatmap ? (
        <div class="detail-heatmap">
          {s.heatmap.map((day) => (
            <div
              key={day.date}
              class={`detail-heatmap-dot ${day.completed ? "detail-heatmap-done" : "detail-heatmap-missed"}`}
              title={day.date}
            />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "20px", opacity: 0.5 }}>Нет данных</div>
      )}

      <CorrelationCard habitId={habit.id} />
    </div>
  );
}

function hasAnyWhy(h: HabitData): boolean {
  return !!(h.whyToday || h.whyMonth || h.whyYear || h.whyIdentity || h.isItBeneficial || h.breakTrigger || h.replacement);
}
