import { dashboardData } from "../../store/energy";
import { haptic } from "../../telegram";
import { navigate } from "../../router";
import { getDayWord } from "../energy/utils";

export function EnergyCard() {
  const data = dashboardData.value;

  const handleClick = () => {
    haptic("light");
    navigate("energy");
  };

  if (!data) {
    return (
      <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
        <div class="hub-card-title">⚡ Энергия</div>
        <div class="hub-card-empty">Расскажи боту как дела — появится первая запись</div>
      </div>
    );
  }

  const types = [
    { key: "physical" as const, emoji: "🏃", color: "var(--physical)" },
    { key: "mental" as const, emoji: "🧠", color: "var(--mental)" },
    { key: "emotional" as const, emoji: "💚", color: "var(--emotional)" },
    { key: "spiritual" as const, emoji: "🔮", color: "var(--spiritual)" },
  ];

  return (
    <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
      <div class="hub-card-header">
        <span class="hub-card-title">⚡ Энергия</span>
        {data.streak > 0 && (
          <span class="hub-card-badge">🔥 {data.streak} {getDayWord(data.streak)}</span>
        )}
      </div>
      <div class="hub-energy-grid">
        {types.map((t) => (
          <div key={t.key} class="hub-energy-item">
            <span class="hub-energy-emoji">{t.emoji}</span>
            <span class="hub-energy-val" style={{ color: t.color }}>{data[t.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
