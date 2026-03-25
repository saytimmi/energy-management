import { useEffect } from "preact/hooks";
import { useState } from "preact/hooks";
import { navigate } from "../../router";
import { haptic, chatWithBot } from "../../telegram";
import {
  reflectionStatus,
  algorithms,
  reflections,
  kaizenObservations,
  digests,
  reflectionStatusLoading,
  algorithmsLoading,
  reflectionsLoading,
  reflectionsHasMore,
  loadKaizenData,
  loadMoreReflections,
} from "../../store/kaizen";
import { botUsername } from "../../store/strategy";
import { AlgorithmDetail } from "./AlgorithmDetail";
import { DigestCard } from "./DigestCard";
import { DigestDetail } from "./DigestDetail";
import type { WeeklyDigestData } from "../../api/types";

interface KaizenScreenProps {
  param?: string;
}

export function KaizenScreen({ param }: KaizenScreenProps) {
  const [selectedDigest, setSelectedDigest] = useState<WeeklyDigestData | null>(null);

  useEffect(() => {
    loadKaizenData();
  }, []);

  // Digest detail view
  if (selectedDigest) {
    return <DigestDetail digest={selectedDigest} onBack={() => setSelectedDigest(null)} />;
  }

  // If param is a number, show AlgorithmDetail
  if (param && /^\d+$/.test(param)) {
    return <AlgorithmDetail id={parseInt(param, 10)} />;
  }

  const handleAskAI = () => {
    if (!botUsername.value) return;
    haptic("medium");
    chatWithBot(botUsername.value, "Давай проведём рефлексию");
  };

  const status = reflectionStatus.value;
  const algos = algorithms.value;
  const refs = reflections.value;
  const obs = kaizenObservations.value;

  return (
    <div class="screen">
      <header class="app-header">
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>🧠 Кайдзен</h1>
      </header>
      <main class="views">
        {/* Ask AI button */}
        <button class="kaizen-ask-btn" onClick={handleAskAI}>
          💬 Спросить AI коуча
          <span style={{ opacity: 0.4, fontSize: "11px" }}>→ Telegram</span>
        </button>

        {/* Reflection status */}
        <ReflectionStatus status={status} loading={reflectionStatusLoading.value} />

        {/* Algorithms library */}
        <div class="section-title">📂 Мои алгоритмы</div>
        {algorithmsLoading.value && <LoadingPlaceholder />}
        {!algorithmsLoading.value && algos.length === 0 && (
          <div class="kaizen-empty">
            Библиотека алгоритмов появится после первой рефлексии
          </div>
        )}
        {!algorithmsLoading.value && algos.length > 0 && (
          <div class="algorithms-grid">
            {algos.map((algo) => (
              <AlgorithmCard
                key={algo.id}
                algorithm={algo}
                onClick={() => {
                  haptic("light");
                  navigate("kaizen", String(algo.id));
                }}
              />
            ))}
          </div>
        )}

        {/* Weekly Digests */}
        {digests.value.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div class="section-title">📊 Недельные дайджесты</div>
            {digests.value.map(d => (
              <DigestCard key={d.id} digest={d} onTap={setSelectedDigest} />
            ))}
          </div>
        )}

        {/* Reflections feed */}
        <div class="section-title" style={{ marginTop: 24 }}>📝 Рефлексии</div>
        {reflectionsLoading.value && refs.length === 0 && <LoadingPlaceholder />}
        {!reflectionsLoading.value && refs.length === 0 && (
          <div class="kaizen-empty">
            Рефлексии появятся после кайдзен-часа с AI коучем
          </div>
        )}
        {refs.length > 0 && (
          <div class="reflections-feed">
            {refs.map((ref) => (
              <ReflectionCard key={ref.id} reflection={ref} />
            ))}
            {reflectionsHasMore.value && (
              <button
                class="kaizen-load-more"
                onClick={() => { haptic("light"); loadMoreReflections(); }}
                disabled={reflectionsLoading.value}
              >
                {reflectionsLoading.value ? "Загрузка..." : "Ещё"}
              </button>
            )}
          </div>
        )}

        {/* Observations */}
        <div class="section-title" style={{ marginTop: 24 }}>👁 Наблюдения</div>
        {obs.length === 0 && (
          <div class="kaizen-empty">
            Наблюдения появятся после чекинов энергии
          </div>
        )}
        {obs.slice(0, 15).map((o) => (
          <div key={o.id} class="observation-card">
            <div class="observation-meta">
              {o.createdAt && new Date(o.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              {" · "}
              {o.energyType === "physical" ? "🦾" : o.energyType === "mental" ? "🧬" : o.energyType === "emotional" ? "🫀" : "🔮"}
              {" "}
              {o.direction === "drop" ? "↓" : o.direction === "rise" ? "↑" : "→"}
            </div>
            {o.trigger && <div class="observation-trigger">{o.trigger}</div>}
            {o.context && <div class="observation-context">{o.context}</div>}
          </div>
        ))}
      </main>
    </div>
  );
}

// --- Sub-components ---

function LoadingPlaceholder() {
  return (
    <div style={{ textAlign: "center", color: "var(--text2)", padding: 20, fontSize: 13 }}>
      Загрузка...
    </div>
  );
}

interface ReflectionStatusProps {
  status: typeof reflectionStatus.value;
  loading: boolean;
}

function ReflectionStatus({ status, loading }: ReflectionStatusProps) {
  if (loading) return <LoadingPlaceholder />;
  if (!status) return null;

  if (status.done && status.reflection) {
    return (
      <div class="reflection-status done">
        <div class="reflection-status-badge done">✓ Рефлексия пройдена</div>
        <div class="reflection-status-summary">{status.reflection.summary}</div>
      </div>
    );
  }

  // Build context summary
  const ctx = status.context;
  const energyStr = ctx.energy.length > 0
    ? ctx.energy.map((e) => `физ ${e.physical} мент ${e.mental} эмо ${e.emotional} дух ${e.spiritual}`).join(", ")
    : "нет данных";
  const habitsStr = `${ctx.habits.completed.length}/${ctx.habits.total}`;

  return (
    <div class="reflection-status pending">
      <div class="reflection-status-badge pending">⏳ Ожидает рефлексии</div>
      <div class="reflection-status-context">
        <span>📅 {ctx.date}</span>
        <span>🔋 {energyStr}</span>
        <span>⚡ {habitsStr} привычек</span>
        {ctx.observations.length > 0 && (
          <span>👁 {ctx.observations.length} наблюдений</span>
        )}
      </div>
    </div>
  );
}

interface AlgorithmCardProps {
  algorithm: typeof algorithms.value[0];
  onClick: () => void;
}

function AlgorithmCard({ algorithm, onClick }: AlgorithmCardProps) {
  const stepsPreview = algorithm.steps.slice(0, 2).join(" → ");
  const AREA_LABELS: Record<string, string> = {
    health: "Здоровье", career: "Карьера", relationships: "Отношения",
    finances: "Финансы", family: "Семья", growth: "Развитие",
    recreation: "Отдых", environment: "Среда",
  };

  return (
    <div class="algorithm-card" onClick={onClick}>
      <div class="algorithm-icon">{algorithm.icon}</div>
      <div class="algorithm-body">
        <div class="algorithm-title">{algorithm.title}</div>
        <div class="algorithm-steps-preview">{stepsPreview}...</div>
        <div class="algorithm-meta">
          {algorithm.lifeArea && (
            <span class="algorithm-area">{AREA_LABELS[algorithm.lifeArea] || algorithm.lifeArea}</span>
          )}
          <span>{algorithm.steps.length} шагов</span>
          {algorithm.usageCount > 0 && <span>· {algorithm.usageCount}×</span>}
        </div>
      </div>
    </div>
  );
}

interface ReflectionCardProps {
  reflection: typeof reflections.value[0];
}

function ReflectionCard({ reflection }: ReflectionCardProps) {
  const date = new Date(reflection.date);
  const dateStr = date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short" });

  return (
    <div class="reflection-card">
      <div class="reflection-date">{dateStr}</div>
      <div class="reflection-summary">{reflection.summary}</div>
      {reflection.insights && (reflection.insights as string[]).length > 0 && (
        <div class="reflection-insights">
          {(reflection.insights as string[]).map((insight, i) => (
            <div key={i} class="reflection-insight">💡 {insight}</div>
          ))}
        </div>
      )}
      {reflection.algorithms.length > 0 && (
        <div class="reflection-algos">
          {reflection.algorithms.map((a) => (
            <span
              key={a.id}
              class="reflection-algo-chip"
              onClick={(e) => {
                e.stopPropagation();
                navigate("kaizen", String(a.id));
              }}
            >
              {a.icon} {a.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
