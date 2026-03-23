import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { api } from "../../api/client";
import type { Observation } from "../../api/types";
import { getNoteWord } from "../energy/utils";
import { habitsData, loadHabits } from "../../store/habits";

const entries = signal<Observation[]>([]);
const journalLoading = signal(true);
const journalError = signal(false);

const emojiMap: Record<string, string> = { physical: "🏃", mental: "🧠", emotional: "💚", spiritual: "🔮" };
const typeNames: Record<string, string> = { physical: "Физическая", mental: "Ментальная", emotional: "Эмоциональная", spiritual: "Духовная" };
const dirNames: Record<string, string> = { drop: "просадка", rise: "рост", low: "низкая", high: "высокая", stable: "стабильно" };

export function Journal() {
  useEffect(() => {
    journalLoading.value = true;
    api.observations()
      .then((data) => { entries.value = data.observations; journalLoading.value = false; })
      .catch(() => { journalError.value = true; journalLoading.value = false; });
    if (!habitsData.value) loadHabits();
  }, []);

  if (journalLoading.value) return <section class="view"><div class="journal-loading"><div class="pulse-ring small" /><p>Загружаю дневник...</p></div></section>;
  if (journalError.value) return <section class="view"><div class="journal-empty-state"><div class="journal-empty-icon">😔</div><p>Не удалось загрузить дневник</p></div></section>;
  if (entries.value.length === 0) return <section class="view"><div class="journal-empty-state"><div class="journal-empty-icon">📝</div><p>Дневник пуст — расскажи боту как себя чувствуешь</p></div></section>;

  const todayKey = new Date().toISOString().split("T")[0];
  const yesterdayKey = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Filter: only observations with actual content (trigger or context)
  const meaningful = entries.value.filter(o => (o.trigger && o.trigger.trim()) || (o.context && o.context.trim()));

  const grouped: Record<string, Observation[]> = {};
  for (const o of meaningful) { const key = o.createdAt.split("T")[0]; (grouped[key] ??= []).push(o); }
  for (const key of Object.keys(grouped)) { grouped[key].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); }
  const days = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));

  // Collect today's completed habits
  const hData = habitsData.value;
  const completedToday = hData
    ? [...hData.morning, ...hData.afternoon, ...hData.evening].filter(h => h.completedToday)
    : [];

  return (
    <section class="view">
      {completedToday.length > 0 && (
        <div class="journal-habits-section" style={{ marginBottom: "24px" }}>
          <div class="tl-day-header">
            <span class="tl-day-label today">Привычки сегодня</span>
            <span class="tl-day-meta">{completedToday.length} выполнено</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {completedToday.map((h) => (
              <div key={h.id} style={{
                background: "var(--surface)", borderRadius: "10px", padding: "10px 14px",
                display: "flex", alignItems: "center", gap: "10px", fontSize: "14px",
              }}>
                <span style={{ fontSize: "16px" }}>{h.icon}</span>
                <span style={{ flex: 1, opacity: 0.8 }}>{h.name}</span>
                <span style={{ fontSize: "12px", color: "var(--accent)" }}>✓</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div class="journal-timeline">
        {days.map(([dateKey, obs]) => {
          const isToday = dateKey === todayKey;
          const isYesterday = dateKey === yesterdayKey;
          const dateLabel = isToday ? "Сегодня" : isYesterday ? "Вчера" : new Date(dateKey + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
          return (
            <div key={dateKey} class="tl-day">
              <div class="tl-day-header">
                <span class={`tl-day-label ${isToday ? "today" : ""}`}>{dateLabel}</span>
                <span class="tl-day-meta">{obs.length} {getNoteWord(obs.length)}</span>
              </div>
              <div class="tl-entries">
                {obs.map((o) => {
                  const time = new Date(o.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={o.id} class="tl-entry">
                      <div class="tl-time">{time}</div>
                      <div class="tl-line"><div class="tl-dot" data-type={o.energyType} /></div>
                      <div class="tl-card" data-type={o.energyType}>
                        <div class="tl-card-top">
                          <span class="tl-type-name">{emojiMap[o.energyType] ?? "•"} {typeNames[o.energyType] ?? o.energyType}</span>
                          <span class={`tl-dir ${o.direction}`}>{dirNames[o.direction] ?? o.direction}</span>
                        </div>
                        {o.context && <div class="tl-context">{o.context}</div>}
                        {o.trigger && o.trigger !== o.context && <div class="tl-trigger">{o.trigger}</div>}
                        {o.recommendation && <div class="tl-rec">💡 {o.recommendation}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
