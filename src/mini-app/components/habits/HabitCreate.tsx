import { useState } from "preact/hooks";
import { createHabit } from "../../store/habits";
import { haptic, hapticSuccess } from "../../telegram";
import type { CreateHabitPayload } from "../../api/types";

// Auto-pick icon based on habit name keywords
const ICON_MAP: Array<[string[], string]> = [
  [["спорт", "трениров", "отжим", "присед", "бег", "пробеж", "фитнес", "зарядк"], "💪"],
  [["медитац", "дыхан", "дышать", "осознан"], "🧘"],
  [["чтен", "книг", "читать", "read"], "📖"],
  [["вод", "воду", "пить", "water"], "💧"],
  [["сон", "спать", "лечь", "sleep", "подъём", "встать"], "😴"],
  [["прогулк", "гулять", "ходьб", "walk", "шаг"], "🚶"],
  [["еда", "питан", "есть", "голодан", "диет", "food"], "🍽️"],
  [["журнал", "дневник", "запис", "journal", "write"], "📝"],
  [["музык", "music", "играть", "guitar", "piano"], "🎵"],
  [["кодинг", "код", "программ", "code", "dev"], "💻"],
  [["учёб", "учить", "study", "learn", "курс"], "🎓"],
  [["йог", "yoga", "растяж", "stretch"], "🧘‍♂️"],
  [["кур", "сигарет", "smoke", "алкогол", "drink"], "🚭"],
  [["телефон", "экран", "screen", "social", "phone"], "📵"],
  [["благодар", "gratitude", "спасибо"], "🙏"],
  [["планир", "план", "plan", "цел"], "🎯"],
  [["vitamins", "витамин", "таблет", "лекарств"], "💊"],
  [["душ", "ванн", "shower", "умыть"], "🚿"],
  [["уборк", "clean", "порядок"], "✨"],
];

function pickIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [keywords, icon] of ICON_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return icon;
  }
  return "✅";
}

const SLOTS = [
  { id: "morning", label: "Утро", icon: "☀️" },
  { id: "afternoon", label: "День", icon: "🌤" },
  { id: "evening", label: "Вечер", icon: "🌙" },
] as const;

interface Props {
  onClose: () => void;
  microActionId?: string | null;
}

export function HabitCreate({ onClose, microActionId }: Props) {
  const [name, setName] = useState("");
  const [routineSlot, setRoutineSlot] = useState<string>("morning");
  const [type, setType] = useState<"build" | "break">("build");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const icon = pickIcon(name);
  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    haptic("medium");

    const payload: CreateHabitPayload = {
      name: name.trim(),
      icon,
      type,
      routineSlot,
      ...(microActionId ? { microActionId } : {}),
    };

    const result = await createHabit(payload);
    setSubmitting(false);

    if (result) {
      hapticSuccess();
      onClose();
    } else {
      setError("Не удалось создать. Попробуй ещё раз.");
    }
  }

  return (
    <div class="habit-create">
      {/* Header */}
      <div class="habit-create-header">
        <button class="habit-create-back" onClick={() => { haptic("light"); onClose(); }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="habit-create-title">Новая привычка</span>
      </div>

      <div class="habit-create-body">
        {/* Name with live icon preview */}
        <div class="form-group">
          <label class="form-label">Что за привычка?</label>
          <div class="create-name-row">
            <span class="create-icon-preview">{icon}</span>
            <input
              class="form-input create-name-input"
              type="text"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="Медитация, Отжимания, Чтение..."
              maxLength={50}
              autoFocus
            />
          </div>
          <p class="form-hint">Иконка подберётся автоматически</p>
        </div>

        {/* Time of day */}
        <div class="form-group">
          <label class="form-label">Когда</label>
          <div class="create-slot-row">
            {SLOTS.map(s => (
              <button
                key={s.id}
                class={`create-slot-btn${routineSlot === s.id ? " active" : ""}`}
                onClick={() => { setRoutineSlot(s.id); haptic("light"); }}
              >
                <span class="create-slot-icon">{s.icon}</span>
                <span class="create-slot-label">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Type toggle */}
        <div class="form-group">
          <label class="form-label">Тип</label>
          <div class="create-type-toggle">
            <button
              class={`create-type-btn${type === "build" ? " active" : ""}`}
              onClick={() => { setType("build"); haptic("light"); }}
            >
              Внедрить
            </button>
            <button
              class={`create-type-btn break${type === "break" ? " active" : ""}`}
              onClick={() => { setType("break"); haptic("light"); }}
            >
              Убрать
            </button>
          </div>
        </div>

        {error && <p class="create-error">{error}</p>}
      </div>

      {/* Submit */}
      <button
        class="create-submit-btn"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {submitting ? "Создаю..." : `Начать ${icon}`}
      </button>
    </div>
  );
}
