import { useEffect } from "preact/hooks";
import { kaizenObservations, kaizenLoading, kaizenError, loadKaizenData } from "../../store/kaizen";
import { haptic } from "../../telegram";

interface KaizenScreenProps {
  param?: string;
}

const ENERGY_EMOJI: Record<string, string> = {
  physical: "🦾",
  mental: "🧬",
  emotional: "🫀",
  spiritual: "🔮",
};

const DIRECTION_ARROW: Record<string, string> = {
  drop: "↓",
  rise: "↑",
  low: "↓",
  high: "↑",
  stable: "→",
};

export function KaizenScreen({ param }: KaizenScreenProps) {
  useEffect(() => { loadKaizenData(); }, []);

  const handleAskAI = () => {
    haptic("medium");
    // Open Telegram chat with bot
    const botUsername = "energy_coach_bot"; // TODO: get from config
    window.open(`https://t.me/${botUsername}`, "_blank");
  };

  return (
    <div class="screen">
      <header class="app-header">
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>🧠 Кайдзен</h1>
      </header>
      <main class="views">
        <button class="kaizen-ask-btn" onClick={handleAskAI}>
          💬 Спросить AI коуча
          <span style={{ opacity: 0.4, fontSize: "11px" }}>→ Telegram</span>
        </button>

        <div style={{ padding: "20px", textAlign: "center", color: "var(--text2)", fontSize: "13px" }}>
          📂 Библиотека алгоритмов появится после первой рефлексии
        </div>

        <div class="section-title">👁 Наблюдения</div>
        {kaizenLoading.value && <div style={{ textAlign: "center", color: "var(--text2)", padding: "20px" }}>Загрузка...</div>}
        {kaizenError.value && <div style={{ textAlign: "center", color: "var(--text2)", padding: "20px" }}>Ошибка загрузки</div>}
        {!kaizenLoading.value && kaizenObservations.value.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text2)", padding: "20px", fontSize: "13px" }}>
            Наблюдения появятся после чекинов энергии
          </div>
        )}
        {kaizenObservations.value.map((obs) => (
          <div key={obs.id} class="observation-card">
            <div class="observation-meta">
              {new Date(obs.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              {" · "}
              {ENERGY_EMOJI[obs.energyType] || "⚡"}
              {" "}
              {DIRECTION_ARROW[obs.direction] || ""}
            </div>
            {obs.trigger && <div class="observation-trigger">{obs.trigger}</div>}
            {obs.context && <div class="observation-context">{obs.context}</div>}
          </div>
        ))}
      </main>
    </div>
  );
}
