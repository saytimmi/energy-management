import type { AnalyticsData } from "../../api/types";

interface Props { data: AnalyticsData; }

export function Analytics({ data }: Props) {
  if (!data?.insights) return null;
  const text = Array.isArray(data.insights) ? data.insights.join("\n") : data.insights;
  const items = text.split(/\n(?=\d+\.)/).filter((s) => s.trim());

  return (
    <div class="analytics-section">
      <h2 class="section-title">Паттерны</h2>
      <div class="analytics-content">
        {items.length <= 1 ? (
          <div class="analytics-card" dangerouslySetInnerHTML={{ __html: formatInsight(text) }} />
        ) : (
          items.map((item, i) => (
            <div key={i} class="analytics-card" dangerouslySetInnerHTML={{ __html: formatInsight(item.trim()) }} />
          ))
        )}
      </div>
    </div>
  );
}

function formatInsight(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
}
