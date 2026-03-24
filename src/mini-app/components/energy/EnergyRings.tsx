import { useEffect, useRef } from "preact/hooks";
import type { DashboardData } from "../../api/types";

const types = [
  { key: "physical", emoji: "🦾", label: "Физическая" },
  { key: "mental", emoji: "🧬", label: "Ментальная" },
  { key: "emotional", emoji: "🫀", label: "Эмоциональная" },
  { key: "spiritual", emoji: "🔮", label: "Духовная" },
] as const;

interface Props { data: DashboardData; }

export function EnergyRings({ data }: Props) {
  return (
    <>
      <div class="energy-rings">
        {types.map((t, i) => (
          <RingCard key={t.key} type={t.key} emoji={t.emoji} label={t.label} value={data[t.key]} delay={i * 120} />
        ))}
      </div>
      {data.loggedAt && (
        <p class="last-update">
          Обновлено{" "}
          {new Date(data.loggedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </>
  );
}

function RingCard({ type, emoji, label, value, delay }: { type: string; emoji: string; label: string; value: number; delay: number }) {
  const fillRef = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const offset = 264 - (value / 10) * 264;
    const timer = setTimeout(() => { if (fillRef.current) fillRef.current.style.strokeDashoffset = String(offset); }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div class="ring-card" data-type={type}>
      <div class="ring-wrap">
        <svg viewBox="0 0 100 100">
          <circle class="ring-bg" cx="50" cy="50" r="42" />
          <circle ref={fillRef} class="ring-fill" cx="50" cy="50" r="42" />
        </svg>
        <div class="ring-inner">
          <span class="ring-val">{value || "—"}</span>
          <span class="ring-emoji">{emoji}</span>
        </div>
      </div>
      <span class="ring-label">{label}</span>
    </div>
  );
}
