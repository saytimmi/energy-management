import { useEffect } from "preact/hooks";
import { navigate } from "../../router";
import { haptic } from "../../telegram";
import { reflectionStatus, algorithms, loadReflectionStatus, loadAlgorithms } from "../../store/kaizen";

export function KaizenCard() {
  useEffect(() => {
    loadReflectionStatus();
    loadAlgorithms();
  }, []);

  const handleClick = () => {
    haptic("light");
    navigate("kaizen");
  };

  const status = reflectionStatus.value;
  const algos = algorithms.value;

  return (
    <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
      <div class="hub-card-header">
        <span class="hub-card-title">🧠 Кайдзен</span>
        {status && (
          <span class={`kaizen-hub-badge ${status.done ? "done" : "pending"}`}>
            {status.done ? "✓" : "⏳"}
          </span>
        )}
      </div>

      {!status && algos.length === 0 && (
        <div class="hub-card-empty">
          После первой рефлексии здесь появятся алгоритмы
        </div>
      )}

      {status && !status.done && (
        <div class="kaizen-hub-status pending">
          Рефлексия ожидает
        </div>
      )}

      {status && status.done && status.reflection && (
        <div class="kaizen-hub-status done">
          {status.reflection.summary.slice(0, 60)}...
        </div>
      )}

      {algos.length > 0 && (
        <div class="kaizen-hub-chips">
          {algos.slice(0, 3).map((a) => (
            <span key={a.id} class="kaizen-hub-chip">{a.icon} {a.title}</span>
          ))}
          {algos.length > 3 && (
            <span class="kaizen-hub-chip more">+{algos.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
