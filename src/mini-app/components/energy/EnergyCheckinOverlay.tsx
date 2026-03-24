import { useState } from "preact/hooks";
import { api } from "../../api/client";
import { haptic, hapticSuccess } from "../../telegram";
import { TriggerPicker } from "./TriggerPicker";
import type { EnergyCheckinResponse } from "../../api/types";

interface Props {
  onClose: () => void;
  onComplete: () => void;
  initialValues?: { physical: number; mental: number; emotional: number; spiritual: number };
}

const TYPES = [
  { key: "physical" as const, emoji: "🦾", label: "Физическая", color: "var(--physical)" },
  { key: "mental" as const, emoji: "🧬", label: "Ментальная", color: "var(--mental)" },
  { key: "emotional" as const, emoji: "🫀", label: "Эмоциональная", color: "var(--emotional)" },
  { key: "spiritual" as const, emoji: "🔮", label: "Духовная", color: "var(--spiritual)" },
];

export function EnergyCheckinOverlay({ onClose, onComplete, initialValues }: Props) {
  const [values, setValues] = useState({
    physical: initialValues?.physical ?? 5,
    mental: initialValues?.mental ?? 5,
    emotional: initialValues?.emotional ?? 5,
    spiritual: initialValues?.spiritual ?? 5,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EnergyCheckinResponse | null>(null);
  const [triggersDone, setTriggersDone] = useState(false);

  const handleSlider = (key: keyof typeof values, val: number) => {
    haptic("light");
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    haptic("medium");
    try {
      const res = await api.submitEnergy({ ...values, logType: "manual" });
      setResult(res);
      hapticSuccess();
    } catch (err) {
      console.error("Checkin failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggersComplete = () => {
    setTriggersDone(true);
    onComplete();
  };

  // Show trigger picker after submit if there are drops/improvements
  if (result && result.triggerInfo && !triggersDone) {
    return (
      <TriggerPicker
        logId={result.logId}
        triggerInfo={result.triggerInfo}
        recommendations={result.recommendations}
        severity={result.severity}
        values={values}
        onDone={handleTriggersComplete}
      />
    );
  }

  // Show success and close if no triggers needed
  if (result && (!result.triggerInfo || triggersDone)) {
    return (
      <div class="checkin-overlay">
        <div class="checkin-overlay-content">
          <div class="checkin-success">
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2>Записано!</h2>
            <div class="checkin-result-grid">
              {TYPES.map(t => (
                <div key={t.key} class="checkin-result-item">
                  <span>{t.emoji}</span>
                  <span style={{ color: t.color, fontWeight: 600 }}>{values[t.key]}</span>
                </div>
              ))}
            </div>
            {result.severity.stable && <p style={{ color: "var(--text2)", marginTop: 8 }}>👍 Стабильно</p>}
            <button class="checkin-done-btn" onClick={() => { haptic("light"); onComplete(); }}>
              Готово
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Slider form
  return (
    <div class="checkin-overlay">
      <div class="checkin-overlay-content">
        <div class="checkin-header">
          <button class="checkin-close" onClick={onClose}>✕</button>
          <h2 class="checkin-title">Записать энергию</h2>
        </div>

        <div class="checkin-sliders">
          {TYPES.map(t => (
            <div key={t.key} class="checkin-slider-row">
              <div class="checkin-slider-label">
                <span>{t.emoji} {t.label}</span>
                <span class="checkin-slider-value" style={{ color: t.color }}>{values[t.key]}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={values[t.key]}
                class="checkin-slider"
                style={{ accentColor: t.color }}
                onInput={(e) => handleSlider(t.key, parseInt((e.target as HTMLInputElement).value))}
              />
              <div class="checkin-slider-scale">
                <span>1</span><span>5</span><span>10</span>
              </div>
            </div>
          ))}
        </div>

        <button
          class="checkin-submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Записываю..." : "⚡ Записать"}
        </button>
      </div>
    </div>
  );
}
