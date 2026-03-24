import type { Observation } from "../../api/types";
import { getTimeAgo } from "./utils";

const emojiMap: Record<string, string> = { physical: "🦾", mental: "🧬", emotional: "🫀", spiritual: "🔮" };
const dirNames: Record<string, string> = { drop: "↓ просадка", rise: "↑ рост", low: "↓ низкая", high: "↑ высокая", stable: "— стабильно" };
const dirIcons: Record<string, string> = { drop: "🔻", rise: "🔺", low: "🔻", high: "🔺", stable: "➖" };

interface Props { observations: Observation[]; }

export function Observations({ observations }: Props) {
  if (observations.length === 0) return null;
  const todayKey = new Date().toISOString().split("T")[0];
  const todayObs = observations.filter((o) => o.createdAt.split("T")[0] === todayKey);
  const notable = observations.filter((o) => ["drop", "rise", "low"].includes(o.direction)).slice(0, 5);
  if (todayObs.length === 0 && notable.length === 0) return null;

  return (
    <div class="observations-section">
      <h2 class="section-title">Последние наблюдения</h2>
      <div class="obs-list">
        {todayObs.length > 0 && (
          <div class="obs-today-card">
            <div class="obs-today-title">Сегодня</div>
            <div class="obs-today-items">
              {todayObs.map((o) => (
                <div key={o.id} class="obs-today-item">
                  <span>{emojiMap[o.energyType] ?? "•"} {dirIcons[o.direction] ?? ""}</span>
                  <span class="obs-today-text">{o.trigger ?? o.context ?? ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {notable.map((o, i) => (
          <div key={o.id} class="obs-item" style={{ animationDelay: `${i * 0.06}s` }}>
            <span class="obs-emoji">{emojiMap[o.energyType] ?? "•"}</span>
            <div class="obs-body">
              <div class="obs-text">{o.context ?? o.trigger ?? ""}</div>
              <div class="obs-meta">
                <span class={`obs-tag ${o.direction}`}>{dirNames[o.direction] ?? o.direction}</span>
                <span>{getTimeAgo(new Date(o.createdAt))}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
