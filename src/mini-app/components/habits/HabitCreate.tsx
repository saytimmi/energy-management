import { useState } from "preact/hooks";
import { createHabit } from "../../store/habits";
import { haptic, hapticSuccess } from "../../telegram";
import type { CreateHabitPayload } from "../../api/types";

const ICONS = [
  "🏃", "🧘", "💪", "🧠", "📖",
  "💧", "🌅", "😴", "🚶", "🎵",
  "📝", "🙏", "🤝", "😊", "🌿",
  "❄️", "🎯", "⏰", "🚭", "📱",
];

const SLOTS = [
  { id: "morning", label: "☀️ Утро" },
  { id: "afternoon", label: "🌤️ День" },
  { id: "evening", label: "🌙 Вечер" },
] as const;

interface Props {
  onClose: () => void;
  microActionId?: string | null;
}

export function HabitCreate({ onClose, microActionId }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [duration, setDuration] = useState("");
  const [routineSlot, setRoutineSlot] = useState<string>("morning");
  const [type, setType] = useState<"build" | "break">("build");

  // Optional "why" (shown on step 2 but not required)
  const [whyToday, setWhyToday] = useState("");
  const [whyYear, setWhyYear] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const totalSteps = 2;

  function canProceed(): boolean {
    if (step === 1) return name.trim().length > 0;
    return true;
  }

  function goBack() {
    haptic("light");
    if (step === 1) {
      onClose();
    } else {
      setStep(step - 1);
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    haptic("medium");

    const payload: CreateHabitPayload = {
      name: name.trim(),
      icon,
      type,
      routineSlot,
      ...(duration ? { duration: parseInt(duration) } : {}),
      ...(microActionId ? { microActionId } : {}),
    };

    if (whyToday.trim()) payload.whyToday = whyToday.trim();
    if (whyYear.trim()) payload.whyYear = whyYear.trim();

    const result = await createHabit(payload);
    setSubmitting(false);

    if (result) {
      hapticSuccess();
      onClose();
    }
  }

  return (
    <div class="habit-create">
      <div class="habit-create-header">
        <button class="habit-create-back" onClick={goBack}>←</button>
        <span class="habit-create-title">
          {step === 1 ? "Новая привычка" : "Зачем? (необязательно)"}
        </span>
      </div>

      <div class="step-dots">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div class={`step-dot${i + 1 <= step ? " active" : ""}`} />
        ))}
      </div>

      {/* Step 1: What + Type (combined) */}
      {step === 1 && (
        <div class="habit-create-body">
          <div class="form-group">
            <label class="form-label">Название</label>
            <input
              class="form-input"
              type="text"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="например, Отжимания"
              maxLength={50}
              autoFocus
            />
          </div>

          <div class="form-group">
            <label class="form-label">Иконка</label>
            <div class="icon-grid">
              {ICONS.map(ic => (
                <button
                  class={`icon-btn${ic === icon ? " selected" : ""}`}
                  onClick={() => { setIcon(ic); haptic("light"); }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Когда</label>
            <div class="slot-buttons">
              {SLOTS.map(s => (
                <button
                  class={`slot-btn${routineSlot === s.id ? " selected" : ""}`}
                  onClick={() => { setRoutineSlot(s.id); haptic("light"); }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Тип</label>
            <div class="slot-buttons">
              <button
                class={`slot-btn${type === "build" ? " selected" : ""}`}
                onClick={() => { setType("build"); haptic("light"); }}
              >
                🟢 Внедрить
              </button>
              <button
                class={`slot-btn${type === "break" ? " selected" : ""}`}
                onClick={() => { setType("break"); haptic("light"); }}
              >
                🔴 Убрать
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Длительность (мин)</label>
            <input
              class="form-input"
              type="number"
              value={duration}
              onInput={(e) => setDuration((e.target as HTMLInputElement).value)}
              placeholder="необязательно"
              min={1}
              max={120}
            />
          </div>
        </div>
      )}

      {/* Step 2: Optional Why */}
      {step === 2 && (
        <div class="habit-create-body">
          <p class="meaning-hint">Осмысли зачем тебе это — поможет не бросить. Можно заполнить потом.</p>

          <div class="form-group">
            <label class="form-label">Зачем сегодня?</label>
            <input
              class="form-input"
              type="text"
              value={whyToday}
              onInput={(e) => setWhyToday((e.target as HTMLInputElement).value)}
              placeholder="Что ты получаешь, когда делаешь это?"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Через год?</label>
            <input
              class="form-input"
              type="text"
              value={whyYear}
              onInput={(e) => setWhyYear((e.target as HTMLInputElement).value)}
              placeholder="Кем ты станешь через год благодаря этому?"
            />
          </div>
        </div>
      )}

      {/* Bottom button */}
      <button
        class="create-next-btn"
        disabled={!canProceed() || submitting}
        onClick={() => {
          if (step === 1) { haptic("light"); setStep(2); }
          else handleSubmit();
        }}
      >
        {step === 1 ? "Далее" : submitting ? "Создаю..." : "Начать 🌱"}
      </button>
    </div>
  );
}
