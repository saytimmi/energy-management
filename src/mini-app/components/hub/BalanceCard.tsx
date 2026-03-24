import { useEffect } from "preact/hooks";
import { navigate } from "../../router";
import { haptic } from "../../telegram";
import { balanceOverview, loadBalanceOverview } from "../../store/balance";
import type { BalanceAreaSummary } from "../../api/types";

export function BalanceCard() {
  useEffect(() => { loadBalanceOverview(); }, []);

  const handleClick = () => {
    haptic("light");
    navigate("balance");
  };

  const overview = balanceOverview.value;

  // No data state
  if (!overview || overview.ratedCount === 0) {
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

  // Show top areas: focus first, then critical (score <= 4), up to 4
  const focusAndCritical = getSummaryAreas(overview.areas);

  return (
    <div class="hub-card" onClick={handleClick} style={{ gridColumn: "1 / -1" }}>
      <div class="hub-card-header">
        <span class="hub-card-title">⚖️ Баланс</span>
        {overview.avgScore !== null && (
          <span style={{ fontSize: "13px", color: "var(--text2)" }}>
            {overview.avgScore}/10
          </span>
        )}
      </div>
      <div class="balance-hub-areas">
        {focusAndCritical.map(area => (
          <BalanceHubArea key={area.area} area={area} />
        ))}
        {overview.ratedCount > focusAndCritical.length && (
          <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "4px" }}>
            ещё {overview.ratedCount - focusAndCritical.length} →
          </div>
        )}
      </div>
    </div>
  );
}

function getSummaryAreas(areas: BalanceAreaSummary[]): BalanceAreaSummary[] {
  const focus = areas.filter(a => a.isFocus && a.score !== null);
  const critical = areas.filter(a => !a.isFocus && a.score !== null && a.score <= 4);
  const combined = [...focus, ...critical];
  // If not enough, add remaining scored areas
  if (combined.length < 4) {
    const remaining = areas.filter(a => a.score !== null && !combined.includes(a))
      .sort((a, b) => (a.score ?? 99) - (b.score ?? 99));
    combined.push(...remaining);
  }
  return combined.slice(0, 4);
}

function BalanceHubArea({ area }: { area: BalanceAreaSummary }) {
  const scoreColor = area.score !== null
    ? area.score <= 4 ? "#ff5b5b" : area.score <= 6 ? "#ffa85b" : "#5be07a"
    : "var(--text3)";

  return (
    <div class="balance-hub-area-row">
      <span>{area.icon}</span>
      <span class="balance-hub-area-name">{area.label}</span>
      {area.isFocus && <span class="balance-focus-badge" style={{ fontSize: "8px", padding: "0 4px" }}>фокус</span>}
      <div class="balance-hub-bar-container">
        <div
          class="balance-hub-bar"
          style={{
            width: area.score !== null ? `${(area.score / 10) * 100}%` : "0%",
            background: scoreColor,
          }}
        />
      </div>
      <span style={{ fontSize: "12px", fontWeight: 600, color: scoreColor, width: "20px", textAlign: "right" }}>
        {area.score ?? "—"}
      </span>
    </div>
  );
}
