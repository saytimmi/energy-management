import { useEffect } from "preact/hooks";
import { strategyData, strategyLoading, loadStrategy } from "../../store/strategy";
import { navigate } from "../../router";
import { haptic } from "../../telegram";
import { Card } from "../shared/Card";
import { Skeleton } from "../shared/Skeleton";

export function StrategyCard() {
  useEffect(() => { loadStrategy(); }, []);

  const handleTap = () => {
    haptic("light");
    navigate("balance", "strategy");
  };

  if (strategyLoading.value) {
    return (
      <Card class="hub-card" onClick={handleTap}>
        <div class="hub-card-header">
          <span class="hub-card-title">Стратегия</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Skeleton width="80%" height="13px" />
          <Skeleton width="50%" height="11px" />
        </div>
      </Card>
    );
  }

  const data = strategyData.value;
  const mission = data?.mission;
  const hasMission = mission?.statement;
  const focusCount = data?.focusAreas.length ?? 0;
  const totalGoals = (data?.focusAreas ?? []).reduce((s, a) => s + a.yearGoals.length + a.quarterGoals.length, 0)
    + (data?.otherAreas ?? []).reduce((s, a) => s + a.yearGoals.length + a.quarterGoals.length, 0);

  return (
    <Card class="hub-card" onClick={handleTap}>
      <div class="hub-card-header">
        <span class="hub-card-title">🧭 Стратегия</span>
      </div>
      {hasMission ? (
        <div style={{ fontSize: "12px", color: "var(--text2)", lineHeight: 1.4, marginBottom: "6px" }}>
          "{mission!.statement!.length > 60 ? mission!.statement!.slice(0, 57) + "..." : mission!.statement}"
        </div>
      ) : (
        <div style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "6px" }}>
          Миссия не определена
        </div>
      )}
      <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "var(--text3)" }}>
        {focusCount > 0 && <span>{focusCount} в фокусе</span>}
        {totalGoals > 0 && <span>{totalGoals} целей</span>}
        {focusCount === 0 && totalGoals === 0 && <span>Нет целей</span>}
      </div>
    </Card>
  );
}
