import { useState } from "preact/hooks";
import { createHabit } from "../../store/habits";
import { haptic, hapticSuccess } from "../../telegram";
import type { CreateHabitPayload, HabitData } from "../../api/types";

// Auto-pick icon based on habit name keywords
const ICON_MAP: Array<[string[], string]> = [
  [["спорт", "трениров", "отжим", "присед", "бег", "пробеж", "фитнес", "зарядк"], "💪"],
  [["медитац", "дыхан", "дышать", "осознан"], "🧘"],
  [["чтен", "книг", "читать", "read"], "📖"],
  [["вод", "воду", "пить", "water"], "💧"],
  [["сон", "спать", "лечь", "sleep", "подъём", "встать"], "😴"],
  [["прогулк", "гулять", "ходьб", "walk", "шаг"], "🚶"],
  [["еда", "питан", "есть", "голодан", "диет", "food", "интервал"], "🍽️"],
  [["журнал", "дневник", "запис", "journal", "write"], "📝"],
  [["музык", "music", "играть", "guitar", "piano"], "🎵"],
  [["кодинг", "код", "программ", "code", "dev"], "💻"],
  [["учёб", "учить", "study", "learn", "курс"], "🎓"],
  [["йог", "yoga", "растяж", "stretch"], "🧘‍♂️"],
  [["кур", "сигарет", "smoke", "алкогол", "drink"], "🚭"],
  [["телефон", "экран", "screen", "social", "phone"], "📵"],
  [["благодар", "gratitude", "спасибо"], "🙏"],
  [["планир", "план", "plan", "цел"], "🎯"],
  [["витамин", "таблет", "лекарств"], "💊"],
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

const LIFE_AREAS = [
  { id: "health", label: "Здоровье", icon: "❤️" },
  { id: "career", label: "Карьера", icon: "💼" },
  { id: "relationships", label: "Отношения", icon: "👫" },
  { id: "finances", label: "Финансы", icon: "💰" },
  { id: "family", label: "Семья", icon: "👨‍👩‍👧" },
  { id: "growth", label: "Развитие", icon: "🧠" },
  { id: "recreation", label: "Отдых", icon: "🎮" },
  { id: "environment", label: "Среда", icon: "🏠" },
] as const;

const SLOTS = [
  { id: "morning", label: "Утро", icon: "☀️" },
  { id: "afternoon", label: "День", icon: "🌤" },
  { id: "evening", label: "Вечер", icon: "🌙" },
] as const;

interface Props {
  onClose: (createdHabit?: HabitData) => void;
  microActionId?: string | null;
}

export function HabitCreate({ onClose, microActionId }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [routineSlot, setRoutineSlot] = useState<string>("morning");
  const [type, setType] = useState<"build" | "break">("build");
  const [isDuration, setIsDuration] = useState(false);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [lifeArea, setLifeArea] = useState<string>("health");

  // Meaning (REQUIRED)
  const [whyToday, setWhyToday] = useState("");
  const [whyYear, setWhyYear] = useState("");
  const [whyIdentity, setWhyIdentity] = useState("");

  // Break meaning (REQUIRED for break)
  const [isItBeneficial, setIsItBeneficial] = useState("");
  const [breakTrigger, setBreakTrigger] = useState("");
  const [replacement, setReplacement] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const icon = pickIcon(name);

  function canProceedStep1(): boolean {
    return name.trim().length > 0;
  }

  function canProceedStep2(): boolean {
    if (type === "build") {
      return whyToday.trim().length > 0 && whyYear.trim().length > 0 && whyIdentity.trim().length > 0;
    }
    return isItBeneficial.trim().length > 0 && breakTrigger.trim().length > 0 && replacement.trim().length > 0;
  }

  async function handleSubmit() {
    if (!canProceedStep2() || submitting) return;
    setSubmitting(true);
    setError("");
    haptic("medium");

    const payload: CreateHabitPayload = {
      name: name.trim(),
      icon,
      type,
      routineSlot,
      lifeArea,
      isDuration,
      ...(isDuration && durationMin ? { duration: durationMin } : {}),
      ...(microActionId ? { microActionId } : {}),
    };

    if (type === "build") {
      payload.whyToday = whyToday.trim();
      payload.whyYear = whyYear.trim();
      payload.whyIdentity = whyIdentity.trim();
    } else {
      payload.isItBeneficial = isItBeneficial.trim();
      payload.breakTrigger = breakTrigger.trim();
      payload.replacement = replacement.trim();
    }

    const result = await createHabit(payload);
    setSubmitting(false);

    if (result) {
      hapticSuccess();
      onClose(result);
    } else {
      setError("Не удалось создать. Проверь соединение.");
    }
  }

  // Step progress
  const totalSteps = 2;

  return (
    <div class="habit-create">
      {/* Header */}
      <div class="habit-create-header">
        <button class="habit-create-back" onClick={() => {
          haptic("light");
          if (step === 2) setStep(1);
          else onClose();
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="habit-create-title">
          {step === 1 ? "Новая привычка" : "Зачем тебе это?"}
        </span>
        <span class="habit-create-step">{step}/{totalSteps}</span>
      </div>

      {/* Progress bar */}
      <div class="create-progress">
        <div class="create-progress-fill" style={{ width: `${(step / totalSteps) * 100}%` }} />
      </div>

      {/* Step 1: What */}
      {step === 1 && (
        <div class="habit-create-body">
          <div class="form-group">
            <div class="create-name-row">
              <span class="create-icon-preview">{icon}</span>
              <input
                class="form-input create-name-input"
                type="text"
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder="Медитация, Бег, Чтение..."
                maxLength={50}
                autoFocus
              />
            </div>
          </div>

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

          <div class="form-group">
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

          {/* Duration toggle */}
          <div class="form-group">
            <div class="create-duration-toggle" onClick={() => { setIsDuration(!isDuration); haptic("light"); }}>
              <div class="duration-toggle-info">
                <span class="duration-toggle-label">На время</span>
                <span class="duration-toggle-hint">Голодание, медитация, без телефона...</span>
              </div>
              <div class={`duration-toggle-switch${isDuration ? " on" : ""}`}>
                <div class="duration-toggle-knob" />
              </div>
            </div>
            {isDuration && (
              <div class="create-duration-presets">
                {[15, 30, 60, 120, 480, 960].map(m => (
                  <button
                    key={m}
                    class={`duration-preset${durationMin === m ? " active" : ""}`}
                    onClick={() => { setDurationMin(m); haptic("light"); }}
                  >
                    {m < 60 ? `${m}м` : `${m / 60}ч`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div class="form-group">
            <label class="form-label">Сфера жизни</label>
            <div class="create-areas">
              {LIFE_AREAS.map(a => (
                <button
                  key={a.id}
                  class={`create-area-btn${lifeArea === a.id ? " active" : ""}`}
                  onClick={() => { setLifeArea(a.id); haptic("light"); }}
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: WHY (REQUIRED for build) */}
      {step === 2 && type === "build" && (
        <div class="habit-create-body">
          <p class="meaning-intro">
            Привычка без смысла не выживет. Ответь честно — это якорь в трудный день.
          </p>

          <div class="form-group">
            <label class="form-label">Какая выгода сегодня?</label>
            <input
              class="form-input"
              type="text"
              value={whyToday}
              onInput={(e) => setWhyToday((e.target as HTMLInputElement).value)}
              placeholder="Что конкретно ты получаешь?"
              autoFocus
            />
          </div>

          <div class="form-group">
            <label class="form-label">Что изменится через год?</label>
            <input
              class="form-input"
              type="text"
              value={whyYear}
              onInput={(e) => setWhyYear((e.target as HTMLInputElement).value)}
              placeholder="Каким станет результат через 365 дней?"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Кем ты станешь?</label>
            <input
              class="form-input"
              type="text"
              value={whyIdentity}
              onInput={(e) => setWhyIdentity((e.target as HTMLInputElement).value)}
              placeholder="Какой ты, когда это часть тебя?"
            />
          </div>
        </div>
      )}

      {/* Step 2: WHY (REQUIRED for break) */}
      {step === 2 && type === "break" && (
        <div class="habit-create-body">
          <p class="meaning-intro">
            Будь честен с собой. Понимание триггера — первый шаг к свободе.
          </p>

          <div class="form-group">
            <label class="form-label">Выгодно ли это организму?</label>
            <input
              class="form-input"
              type="text"
              value={isItBeneficial}
              onInput={(e) => setIsItBeneficial((e.target as HTMLInputElement).value)}
              placeholder="Честно — что это даёт и забирает?"
              autoFocus
            />
          </div>

          <div class="form-group">
            <label class="form-label">Что запускает привычку?</label>
            <input
              class="form-input"
              type="text"
              value={breakTrigger}
              onInput={(e) => setBreakTrigger((e.target as HTMLInputElement).value)}
              placeholder="Какая ситуация, эмоция, время?"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Что сделаешь вместо?</label>
            <input
              class="form-input"
              type="text"
              value={replacement}
              onInput={(e) => setReplacement((e.target as HTMLInputElement).value)}
              placeholder="Какое действие заменит в момент триггера?"
            />
          </div>
        </div>
      )}

      {error && <p class="create-error">{error}</p>}

      {/* Bottom button */}
      <button
        class="create-submit-btn"
        disabled={step === 1 ? !canProceedStep1() : (!canProceedStep2() || submitting)}
        onClick={() => {
          if (step === 1) { haptic("light"); setStep(2); }
          else handleSubmit();
        }}
      >
        {step === 1 ? "Далее →" : submitting ? "Создаю..." : `Начать ${icon}`}
      </button>
    </div>
  );
}
