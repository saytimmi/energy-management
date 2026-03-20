import { useState } from "preact/hooks";
import { createHabit } from "../../store/habits";
import { haptic, hapticSuccess } from "../../telegram";
import type { CreateHabitPayload } from "../../api/types";

const ICONS = [
  "\u{1F3C3}", "\u{1F9D8}", "\u{1F4AA}", "\u{1F9E0}", "\u{1F4D6}",
  "\u{1F4A7}", "\u{1F305}", "\u{1F634}", "\u{1F6B6}", "\u{1F3B5}",
  "\u{1F4DD}", "\u{1F64F}", "\u{1F91D}", "\u{1F60A}", "\u{1F33F}",
  "\u{2744}\u{FE0F}", "\u{1F3AF}", "\u{23F0}", "\u{1F6AD}", "\u{1F4F1}",
];

const SLOTS = [
  { id: "morning", label: "\u{2600}\u{FE0F} \u0423\u0442\u0440\u043E" },
  { id: "afternoon", label: "\u{1F324}\u{FE0F} \u0414\u0435\u043D\u044C" },
  { id: "evening", label: "\u{1F319} \u0412\u0435\u0447\u0435\u0440" },
] as const;

interface Props {
  onClose: () => void;
  microActionId?: string | null;
}

export function HabitCreate({ onClose, microActionId }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("\u{1F3AF}");
  const [duration, setDuration] = useState("");
  const [routineSlot, setRoutineSlot] = useState<string>("morning");
  const [triggerAction, setTriggerAction] = useState("");
  const [type, setType] = useState<"build" | "break" | null>(null);

  // Build meaning
  const [whyToday, setWhyToday] = useState("");
  const [whyMonth, setWhyMonth] = useState("");
  const [whyYear, setWhyYear] = useState("");
  const [whyIdentity, setWhyIdentity] = useState("");

  // Break meaning
  const [isItBeneficial, setIsItBeneficial] = useState("");
  const [breakTrigger, setBreakTrigger] = useState("");
  const [replacement, setReplacement] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const totalSteps = 4;

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return name.trim().length > 0 && routineSlot !== "";
      case 2:
        return type !== null;
      case 3:
        if (type === "build") {
          return whyToday.trim().length > 0 && whyMonth.trim().length > 0 &&
                 whyYear.trim().length > 0 && whyIdentity.trim().length > 0;
        }
        return isItBeneficial.trim().length > 0 && breakTrigger.trim().length > 0 &&
               replacement.trim().length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  }

  function goNext() {
    if (!canProceed()) return;
    haptic("light");
    setStep(step + 1);
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
      type: type!,
      routineSlot,
      ...(duration ? { duration: parseInt(duration) } : {}),
      ...(triggerAction.trim() ? { triggerAction: triggerAction.trim() } : {}),
      ...(microActionId ? { microActionId } : {}),
    };

    if (type === "build") {
      payload.whyToday = whyToday.trim();
      payload.whyMonth = whyMonth.trim();
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
      onClose();
    }
  }

  const slotLabel = SLOTS.find(s => s.id === routineSlot)?.label ?? routineSlot;
  const typeLabel = type === "build" ? "\u{1F7E2} \u0412\u043D\u0435\u0434\u0440\u0438\u0442\u044C" : "\u{1F534} \u0423\u0431\u0440\u0430\u0442\u044C";

  return (
    <div class="habit-create">
      <div class="habit-create-header">
        <button class="habit-create-back" onClick={goBack}>{"\u2190"}</button>
        <span class="habit-create-title">
          {step === 1 && "\u0427\u0442\u043E \u0437\u0430 \u043F\u0440\u0438\u0432\u044B\u0447\u043A\u0430?"}
          {step === 2 && "\u041A\u0430\u043A\u043E\u0439 \u0442\u0438\u043F?"}
          {step === 3 && "\u0417\u0430\u0447\u0435\u043C?"}
          {step === 4 && "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435"}
        </span>
      </div>

      <div class="step-dots">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div class={`step-dot${i + 1 <= step ? " active" : ""}`} />
        ))}
      </div>

      {/* Step 1: What */}
      {step === 1 && (
        <div class="habit-create-body">
          <div class="form-group">
            <label class="form-label">{"\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435"}</label>
            <input
              class="form-input"
              type="text"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder={"\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u041E\u0442\u0436\u0438\u043C\u0430\u043D\u0438\u044F"}
              maxLength={50}
            />
          </div>

          <div class="form-group">
            <label class="form-label">{"\u0418\u043A\u043E\u043D\u043A\u0430"}</label>
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
            <label class="form-label">{"\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C (\u043C\u0438\u043D)"}</label>
            <input
              class="form-input"
              type="number"
              value={duration}
              onInput={(e) => setDuration((e.target as HTMLInputElement).value)}
              placeholder={"\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E"}
              min={1}
              max={120}
            />
          </div>

          <div class="form-group">
            <label class="form-label">{"\u0420\u0430\u0441\u043F\u043E\u0440\u044F\u0434\u043E\u043A"}</label>
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
            <label class="form-label">{"\u041F\u043E\u0441\u043B\u0435 \u0447\u0435\u0433\u043E?"}</label>
            <input
              class="form-input"
              type="text"
              value={triggerAction}
              onInput={(e) => setTriggerAction((e.target as HTMLInputElement).value)}
              placeholder={"\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u043F\u043E\u0441\u043B\u0435 \u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0433\u043E \u043A\u043E\u0444\u0435"}
            />
          </div>
        </div>
      )}

      {/* Step 2: Type */}
      {step === 2 && (
        <div class="habit-create-body">
          <div class="type-cards">
            <div
              class={`type-card${type === "build" ? " selected" : ""}`}
              onClick={() => { setType("build"); haptic("light"); }}
            >
              <div class="type-card-emoji">{"\u{1F7E2}"}</div>
              <div class="type-card-label">{"\u0412\u043D\u0435\u0434\u0440\u0438\u0442\u044C"}</div>
            </div>
            <div
              class={`type-card${type === "break" ? " selected" : ""}`}
              onClick={() => { setType("break"); haptic("light"); }}
            >
              <div class="type-card-emoji">{"\u{1F534}"}</div>
              <div class="type-card-label">{"\u0423\u0431\u0440\u0430\u0442\u044C"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3a: Build meaning */}
      {step === 3 && type === "build" && (
        <div class="habit-create-body">
          <p class="meaning-hint">{"\u041E\u0441\u043C\u044B\u0441\u043B\u0438 \u0437\u0430\u0447\u0435\u043C \u0442\u0435\u0431\u0435 \u044D\u0442\u043E. \u042D\u0442\u043E \u043F\u043E\u043C\u043E\u0436\u0435\u0442 \u043D\u0435 \u0431\u0440\u043E\u0441\u0438\u0442\u044C."}</p>

          <div class="form-group">
            <label class="form-label">{"\u0412\u044B\u0433\u043E\u0434\u043D\u043E \u0441\u0435\u0433\u043E\u0434\u043D\u044F?"}</label>
            <input
              class="form-input"
              type="text"
              value={whyToday}
              onInput={(e) => setWhyToday((e.target as HTMLInputElement).value)}
              placeholder={"\u0427\u0442\u043E \u0442\u044B \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0448\u044C, \u043A\u043E\u0433\u0434\u0430 \u0434\u0435\u043B\u0430\u0435\u0448\u044C \u044D\u0442\u043E?"}
            />
          </div>

          <div class="form-group">
            <label class="form-label">{"\u0427\u0435\u0440\u0435\u0437 \u043C\u0435\u0441\u044F\u0446?"}</label>
            <input
              class="form-input"
              type="text"
              value={whyMonth}
              onInput={(e) => setWhyMonth((e.target as HTMLInputElement).value)}
              placeholder={"\u041A\u0430\u043A \u044D\u0442\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u0442 \u0442\u0432\u043E\u044E \u0436\u0438\u0437\u043D\u044C \u0447\u0435\u0440\u0435\u0437 \u043C\u0435\u0441\u044F\u0446?"}
            />
          </div>

          <div class="form-group">
            <label class="form-label">{"\u0427\u0435\u0440\u0435\u0437 \u0433\u043E\u0434?"}</label>
            <input
              class="form-input"
              type="text"
              value={whyYear}
              onInput={(e) => setWhyYear((e.target as HTMLInputElement).value)}
              placeholder={"\u041A\u0435\u043C \u0442\u044B \u0441\u0442\u0430\u043D\u0435\u0448\u044C \u0447\u0435\u0440\u0435\u0437 \u0433\u043E\u0434 \u0431\u043B\u0430\u0433\u043E\u0434\u0430\u0440\u044F \u044D\u0442\u043E\u043C\u0443?"}
            />
          </div>

          <div class="form-group">
            <label class="form-label">{"\u0412\u0435\u0440\u0441\u0438\u044F \u0441\u0435\u0431\u044F?"}</label>
            <input
              class="form-input"
              type="text"
              value={whyIdentity}
              onInput={(e) => setWhyIdentity((e.target as HTMLInputElement).value)}
              placeholder={"\u041A\u0430\u043A\u043E\u0439 \u0442\u044B, \u043A\u043E\u0433\u0434\u0430 \u044D\u0442\u043E \u043F\u0440\u0438\u0432\u044B\u0447\u043A\u0430?"}
            />
          </div>
        </div>
      )}

      {/* Step 3b: Break meaning */}
      {step === 3 && type === "break" && (
        <div class="habit-create-body">
          <p class="meaning-hint">{"\u0411\u0443\u0434\u044C \u0447\u0435\u0441\u0442\u0435\u043D \u0441 \u0441\u043E\u0431\u043E\u0439. \u042D\u0442\u043E \u043F\u0435\u0440\u0432\u044B\u0439 \u0448\u0430\u0433 \u043A \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F\u043C."}</p>

          <div class="form-group">
            <label class="form-label">{"\u0412\u044B\u0433\u043E\u0434\u043D\u043E \u043B\u0438 \u044D\u0442\u043E \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u043C\u0443?"}</label>
            <input
              class="form-input"
              type="text"
              value={isItBeneficial}
              onInput={(e) => setIsItBeneficial((e.target as HTMLInputElement).value)}
              placeholder={"\u0411\u0443\u0434\u044C \u0447\u0435\u0441\u0442\u0435\u043D \u0441 \u0441\u043E\u0431\u043E\u0439"}
            />
          </div>

          <div class="form-group">
            <label class="form-label">{"\u0417\u0410\u0427\u0415\u041C \u0442\u044B \u044D\u0442\u043E \u0434\u0435\u043B\u0430\u0435\u0448\u044C? \u0427\u0442\u043E \u0442\u0440\u0438\u0433\u0433\u0435\u0440\u0438\u0442?"}</label>
            <input
              class="form-input"
              type="text"
              value={breakTrigger}
              onInput={(e) => setBreakTrigger((e.target as HTMLInputElement).value)}
              placeholder={"\u0427\u0442\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u044D\u0442\u0443 \u043F\u0440\u0438\u0432\u044B\u0447\u043A\u0443?"}
            />
          </div>

          <div class="form-group">
            <label class="form-label">{"\u0427\u0442\u043E \u0412\u041C\u0415\u0421\u0422\u041E \u0432 \u043C\u043E\u043C\u0435\u043D\u0442 \u0442\u0440\u0438\u0433\u0433\u0435\u0440\u0430?"}</label>
            <input
              class="form-input"
              type="text"
              value={replacement}
              onInput={(e) => setReplacement((e.target as HTMLInputElement).value)}
              placeholder={"\u041A\u0430\u043A\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0437\u0430\u043C\u0435\u043D\u0438\u0442?"}
            />
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <div class="habit-create-body">
          <div class="summary-card">
            <div class="summary-row">
              <span class="summary-label">{"\u041F\u0440\u0438\u0432\u044B\u0447\u043A\u0430"}</span>
              <span class="summary-value">{icon} {name}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">{"\u0420\u0430\u0441\u043F\u043E\u0440\u044F\u0434\u043E\u043A"}</span>
              <span class="summary-value">{slotLabel}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">{"\u0422\u0438\u043F"}</span>
              <span class="summary-value">{typeLabel}</span>
            </div>
            {duration && (
              <div class="summary-row">
                <span class="summary-label">{"\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C"}</span>
                <span class="summary-value">{duration} {"\u043C\u0438\u043D"}</span>
              </div>
            )}
            {triggerAction && (
              <div class="summary-row">
                <span class="summary-label">{"\u0422\u0440\u0438\u0433\u0433\u0435\u0440"}</span>
                <span class="summary-value">{triggerAction}</span>
              </div>
            )}

            <div class="summary-why">
              {type === "build" ? (
                <>
                  <div class="summary-why-item">
                    <span class="summary-why-label">{"\u0421\u0435\u0433\u043E\u0434\u043D\u044F: "}</span>{whyToday}
                  </div>
                  <div class="summary-why-item">
                    <span class="summary-why-label">{"\u041C\u0435\u0441\u044F\u0446: "}</span>{whyMonth}
                  </div>
                  <div class="summary-why-item">
                    <span class="summary-why-label">{"\u0413\u043E\u0434: "}</span>{whyYear}
                  </div>
                  <div class="summary-why-item">
                    <span class="summary-why-label">{"\u0418\u0434\u0435\u043D\u0442\u0438\u0447\u043D\u043E\u0441\u0442\u044C: "}</span>{whyIdentity}
                  </div>
                </>
              ) : (
                <>
                  <div class="summary-why-item">
                    <span class="summary-why-label">{"\u0412\u044B\u0433\u043E\u0434\u0430: "}</span>{isItBeneficial}
                  </div>
                  <div class="summary-why-item">
                    <span class="summary-why-label">{"\u0422\u0440\u0438\u0433\u0433\u0435\u0440: "}</span>{breakTrigger}
                  </div>
                  <div class="summary-why-item">
                    <span class="summary-why-label">{"\u0417\u0430\u043C\u0435\u043D\u0430: "}</span>{replacement}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom button */}
      <button
        class="create-next-btn"
        disabled={!canProceed() || submitting}
        onClick={step < 4 ? goNext : handleSubmit}
      >
        {step < 4 ? "\u0414\u0430\u043B\u0435\u0435" : submitting ? "\u0421\u043E\u0437\u0434\u0430\u044E..." : "\u041D\u0430\u0447\u0430\u0442\u044C \u{1F331}"}
      </button>
    </div>
  );
}
