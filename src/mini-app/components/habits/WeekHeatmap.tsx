import { habitsData } from "../../store/habits";
import { todayProgress } from "../../store/habits";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function WeekHeatmap() {
  const today = new Date().getDay(); // 0=Sun, 1=Mon...
  // Convert to Mon=0 index
  const todayIdx = today === 0 ? 6 : today - 1;

  const progress = todayProgress.value;
  const total = progress.total;
  const completed = progress.completed;

  return (
    <div class="week-heatmap">
      {DAY_LABELS.map((label, i) => {
        let cls = "heatmap-day heatmap-empty";
        if (i === todayIdx && total > 0) {
          if (completed === total) {
            cls = "heatmap-day heatmap-done heatmap-today";
          } else if (completed > 0) {
            cls = "heatmap-day heatmap-partial heatmap-today";
          } else {
            cls = "heatmap-day heatmap-empty heatmap-today";
          }
        } else if (i === todayIdx) {
          cls = "heatmap-day heatmap-empty heatmap-today";
        }

        return (
          <div key={i} class={cls}>
            {label}
          </div>
        );
      })}
    </div>
  );
}
