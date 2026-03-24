import { useState, useEffect } from "preact/hooks";
import { api } from "../../api/client";
import { haptic, hapticSuccess } from "../../telegram";
import type { BalanceAreaSummary } from "../../api/types";

const AREA_ORDER = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];

const AREA_META: Record<string, { icon: string; label: string }> = {
  health: { icon: "🩺", label: "Здоровье" },
  career: { icon: "🚀", label: "Карьера" },
  relationships: { icon: "💞", label: "Отношения" },
  finances: { icon: "💎", label: "Финансы" },
  family: { icon: "🏡", label: "Семья" },
  growth: { icon: "📚", label: "Развитие" },
  recreation: { icon: "🧘", label: "Отдых" },
  environment: { icon: "🌿", label: "Среда" },
};

interface Props {
  areas?: BalanceAreaSummary[];
  onClose: () => void;
  onComplete: () => void;
}

export function BalanceRateOverlay({ areas, onClose, onComplete }: Props) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const initial: Record<string, number> = {};
    for (const area of AREA_ORDER) {
      const existing = areas?.find(a => a.area === area);
      initial[area] = existing?.score ?? 5;
    }
    setValues(initial);
  }, [areas]);

  const handleSlider = (area: string, val: number) => {
    haptic("light");
    setValues(prev => ({ ...prev, [area]: val }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    haptic("medium");
    try {
      const ratings = AREA_ORDER.map(area => ({
        area,
        score: values[area] ?? 5,
      }));
      await api.rateBalance(ratings);
      hapticSuccess();
      onComplete();
    } catch (err) {
      console.error("Balance rate failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const scoreColor = (score: number) =>
    score <= 4 ? "#ff5b5b" : score <= 6 ? "#ffa85b" : "#5be07a";

  return (
    <div class="checkin-overlay">
      <div class="checkin-overlay-content">
        <div class="checkin-header">
          <button class="checkin-close" onClick={onClose}>✕</button>
          <h2 class="checkin-title">Оценить баланс</h2>
        </div>

        <div class="checkin-sliders">
          {AREA_ORDER.map(area => {
            const meta = AREA_META[area];
            const val = values[area] ?? 5;
            return (
              <div key={area} class="checkin-slider-row">
                <div class="checkin-slider-label">
                  <span>{meta.icon} {meta.label}</span>
                  <span class="checkin-slider-value" style={{ color: scoreColor(val) }}>{val}</span>
                </div>
                <input
                  type="range" min="1" max="10" value={val}
                  class="checkin-slider"
                  style={{ accentColor: scoreColor(val) }}
                  onInput={(e) => handleSlider(area, parseInt((e.target as HTMLInputElement).value))}
                />
                <div class="checkin-slider-scale">
                  <span>1</span><span>5</span><span>10</span>
                </div>
              </div>
            );
          })}
        </div>

        <button class="checkin-submit-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Сохраняю..." : "Сохранить оценки"}
        </button>
      </div>
    </div>
  );
}
