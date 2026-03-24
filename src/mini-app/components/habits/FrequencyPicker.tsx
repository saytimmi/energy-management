import { haptic } from "../../telegram";

const DAY_LABELS = [
  { id: 1, label: "Пн" },
  { id: 2, label: "Вт" },
  { id: 3, label: "Ср" },
  { id: 4, label: "Чт" },
  { id: 5, label: "Пт" },
  { id: 6, label: "Сб" },
  { id: 7, label: "Вс" },
];

interface Props {
  frequency: string;
  customDays: number[];
  targetPerWeek: number | null;
  onFrequencyChange: (freq: string) => void;
  onCustomDaysChange: (days: number[]) => void;
  onTargetPerWeekChange: (n: number | null) => void;
}

export function FrequencyPicker({
  frequency, customDays, targetPerWeek,
  onFrequencyChange, onCustomDaysChange, onTargetPerWeekChange,
}: Props) {
  return (
    <div class="frequency-picker">
      <div class="frequency-options">
        <button
          class={`freq-option${frequency === "daily" ? " active" : ""}`}
          onClick={() => { onFrequencyChange("daily"); haptic("light"); }}
        >
          Каждый день
        </button>
        <button
          class={`freq-option${frequency === "custom" ? " active" : ""}`}
          onClick={() => { onFrequencyChange("custom"); haptic("light"); }}
        >
          Дни недели
        </button>
        <button
          class={`freq-option${frequency === "weekly" ? " active" : ""}`}
          onClick={() => { onFrequencyChange("weekly"); haptic("light"); }}
        >
          N раз/нед
        </button>
      </div>

      {frequency === "custom" && (
        <div class="frequency-days">
          {DAY_LABELS.map(d => (
            <button
              key={d.id}
              class={`freq-day-btn${customDays.includes(d.id) ? " active" : ""}`}
              onClick={() => {
                haptic("light");
                const next = customDays.includes(d.id)
                  ? customDays.filter(x => x !== d.id)
                  : [...customDays, d.id].sort((a, b) => a - b);
                onCustomDaysChange(next);
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {frequency === "weekly" && (
        <div class="frequency-target">
          <span class="freq-target-label">Сколько раз в неделю:</span>
          <div class="freq-target-btns">
            {[2, 3, 4, 5].map(n => (
              <button
                key={n}
                class={`freq-target-btn${targetPerWeek === n ? " active" : ""}`}
                onClick={() => { onTargetPerWeekChange(n); haptic("light"); }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
