import { navigate } from "../../router";
import { haptic } from "../../telegram";

export function BalanceCard() {
  const handleClick = () => {
    haptic("light");
    navigate("balance");
  };

  return (
    <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
      <div class="hub-card-header">
        <span class="hub-card-title">⚖️ Баланс</span>
      </div>
      <div class="hub-card-empty">
        Расскажи боту о своих целях — появится колесо баланса
      </div>
    </div>
  );
}
