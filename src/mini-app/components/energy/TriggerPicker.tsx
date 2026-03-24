import { useState } from "preact/hooks";
import { api } from "../../api/client";
import { haptic, hapticSuccess } from "../../telegram";
import type { EnergyCheckinResponse } from "../../api/types";

const ENERGY_LABELS: Record<string, string> = {
  physical: "физической", mental: "ментальной",
  emotional: "эмоциональной", spiritual: "духовной",
};

interface Props {
  logId: number;
  triggerInfo: NonNullable<EnergyCheckinResponse["triggerInfo"]>;
  recommendations: EnergyCheckinResponse["recommendations"];
  severity: EnergyCheckinResponse["severity"];
  values: { physical: number; mental: number; emotional: number; spiritual: number };
  onDone: () => void;
}

export function TriggerPicker({ logId, triggerInfo, recommendations, severity, onDone }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const toggle = (trigger: string) => {
    haptic("light");
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(trigger)) next.delete(trigger); else next.add(trigger);
      return next;
    });
  };

  const addCustom = () => {
    if (!customText.trim()) return;
    haptic("light");
    setSelected(prev => new Set(prev).add(customText.trim()));
    setCustomText("");
    setShowCustom(false);
  };

  const handleDone = async () => {
    if (selected.size === 0) { onDone(); return; }
    if (!showContext) { setShowContext(true); return; }

    setSubmitting(true);
    haptic("medium");
    try {
      await api.submitTriggers(logId, {
        triggers: [...selected],
        context: context.trim() || undefined,
        energyType: triggerInfo.energyType,
        direction: triggerInfo.direction,
      });
      hapticSuccess();
    } catch (err) {
      console.error("Submit triggers failed:", err);
    }
    setSubmitting(false);
    onDone();
  };

  const question = triggerInfo.direction === "rise"
    ? `Что помогло ${ENERGY_LABELS[triggerInfo.energyType]}?`
    : `Почему ${ENERGY_LABELS[triggerInfo.energyType]} просела?`;

  // Context input step
  if (showContext) {
    return (
      <div class="checkin-overlay">
        <div class="checkin-overlay-content">
          <h2 class="checkin-title" style={{ marginBottom: 8 }}>Что произошло?</h2>
          <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 16 }}>
            Опиши ситуацию коротко — поможет найти паттерны
          </p>
          <textarea
            class="trigger-context-input"
            value={context}
            onInput={(e) => setContext((e.target as HTMLTextAreaElement).value)}
            placeholder='Например: не мог уснуть, листал телефон до 2 ночи'
            rows={3}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button class="trigger-skip-btn" onClick={() => { setContext(""); handleDoneSubmit(); }} style={{ flex: 1 }}>
              Пропустить
            </button>
            <button class="checkin-submit-btn" onClick={handleDone} disabled={submitting} style={{ flex: 1, marginTop: 0 }}>
              {submitting ? "..." : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleDoneSubmit() {
    setSubmitting(true);
    haptic("medium");
    try {
      await api.submitTriggers(logId, {
        triggers: [...selected],
        context: undefined,
        energyType: triggerInfo.energyType,
        direction: triggerInfo.direction,
      });
      hapticSuccess();
    } catch (err) {
      console.error("Submit triggers failed:", err);
    }
    setSubmitting(false);
    onDone();
  }

  return (
    <div class="checkin-overlay">
      <div class="checkin-overlay-content">
        <h2 class="checkin-title" style={{ marginBottom: 16 }}>{question}</h2>

        {/* Severity summary */}
        <div class="trigger-severity-summary">
          {severity.drops.map(d => (
            <span key={d.type} class="trigger-change drop">{d.prev} → {d.current} (−{d.drop})</span>
          ))}
          {severity.improvements.map(d => (
            <span key={d.type} class="trigger-change rise">{d.prev} → {d.current} (+{-d.drop})</span>
          ))}
        </div>

        {/* Trigger buttons */}
        <div class="trigger-grid">
          {triggerInfo.triggers.map(t => (
            <button
              key={t}
              class={`trigger-btn${selected.has(t) ? " selected" : ""}`}
              onClick={() => toggle(t)}
            >
              {selected.has(t) && "✅ "}{t}
            </button>
          ))}
        </div>

        {/* Custom input */}
        {showCustom ? (
          <div class="trigger-custom">
            <input
              class="form-input"
              value={customText}
              onInput={(e) => setCustomText((e.target as HTMLInputElement).value)}
              placeholder="Своя причина"
              onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
            />
            <button class="trigger-custom-add" onClick={addCustom}>+</button>
          </div>
        ) : (
          <button class="trigger-custom-btn" onClick={() => { haptic("light"); setShowCustom(true); }}>
            ✍️ Свой вариант
          </button>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div class="trigger-recommendations">
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>⚡ Рекомендации:</div>
            {recommendations.slice(0, 3).map((r, i) => (
              <div key={i} class="trigger-rec-item">→ {r.name}, {r.duration} мин</div>
            ))}
          </div>
        )}

        {/* Done */}
        <button class="checkin-submit-btn" onClick={handleDone} disabled={submitting}>
          {selected.size === 0 ? "Пропустить" : `Готово (${selected.size})`}
        </button>
      </div>
    </div>
  );
}
