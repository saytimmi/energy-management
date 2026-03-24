import { navigate } from "../../router";
import { haptic } from "../../telegram";

export function KaizenCard() {
  const handleClick = () => {
    haptic("light");
    navigate("kaizen");
  };

  return (
    <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
      <div class="hub-card-header">
        <span class="hub-card-title">🧠 Кайдзен</span>
      </div>
      <div class="hub-card-empty">
        После первой рефлексии здесь появятся алгоритмы
      </div>
    </div>
  );
}
