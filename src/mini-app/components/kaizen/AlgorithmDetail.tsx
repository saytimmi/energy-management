import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { navigate } from "../../router";
import { haptic, openTelegramLink } from "../../telegram";
import { api } from "../../api/client";
import { deleteAlgorithm } from "../../store/kaizen";
import { botUsername } from "../../store/strategy";
import type { AlgorithmData } from "../../api/types";

const algorithmData = signal<AlgorithmData | null>(null);
const loading = signal(true);
const error = signal(false);

interface AlgorithmDetailProps {
  id: number;
}

const AREA_LABELS: Record<string, string> = {
  health: "Здоровье", career: "Карьера", relationships: "Отношения",
  finances: "Финансы", family: "Семья", growth: "Развитие",
  recreation: "Отдых", environment: "Среда",
};

export function AlgorithmDetail({ id }: AlgorithmDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loading.value = true;
    error.value = false;
    algorithmData.value = null;

    api.algorithm(id)
      .then((data) => { algorithmData.value = data; })
      .catch(() => { error.value = true; })
      .finally(() => { loading.value = false; });
  }, [id]);

  const handleBack = () => {
    haptic("light");
    navigate("kaizen");
  };

  const handleAskAI = () => {
    if (!botUsername.value) return;
    haptic("medium");
    const algoTitle = algorithmData.value?.title ?? "алгоритм";
    openTelegramLink(botUsername.value + "?text=" + encodeURIComponent(`Хочу обсудить алгоритм "${algoTitle}"`));
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    haptic("medium");
    const ok = await deleteAlgorithm(id);
    if (ok) {
      navigate("kaizen");
    }
    setDeleting(false);
    setConfirmDelete(false);
  };

  if (loading.value) {
    return (
      <div class="screen">
        <header class="app-header">
          <button class="back-btn" onClick={handleBack}>← Назад</button>
        </header>
        <main class="views">
          <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Загрузка...</div>
        </main>
      </div>
    );
  }

  if (error.value || !algorithmData.value) {
    return (
      <div class="screen">
        <header class="app-header">
          <button class="back-btn" onClick={handleBack}>← Назад</button>
        </header>
        <main class="views">
          <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Алгоритм не найден</div>
        </main>
      </div>
    );
  }

  const algo = algorithmData.value;
  const steps = algo.steps as string[];
  const createdDate = new Date(algo.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div class="screen">
      <header class="app-header">
        <button class="back-btn" onClick={handleBack}>← Назад</button>
      </header>
      <main class="views">
        {/* Header */}
        <div class="algo-detail-header">
          <div class="algo-detail-icon">{algo.icon}</div>
          <div>
            <div class="algo-detail-title">{algo.title}</div>
            <div class="algo-detail-meta">
              {algo.lifeArea && <span class="algorithm-area">{AREA_LABELS[algo.lifeArea] || algo.lifeArea}</span>}
              <span>{createdDate}</span>
              {algo.usageCount > 0 && <span>· Использован {algo.usageCount}×</span>}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div class="section-title">Шаги</div>
        <div class="algo-steps">
          {steps.map((step, i) => (
            <div key={i} class="algo-step">
              <div class="algo-step-num">{i + 1}</div>
              <div class="algo-step-text">{step}</div>
            </div>
          ))}
        </div>

        {/* Context */}
        {algo.context && (
          <>
            <div class="section-title" style={{ marginTop: 20 }}>Контекст</div>
            <div class="algo-context">{algo.context}</div>
          </>
        )}

        {/* Source reflection */}
        {algo.sourceReflection && (
          <div class="algo-source">
            Из рефлексии {new Date(algo.sourceReflection.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
          </div>
        )}

        {/* Ask AI about this */}
        <button class="kaizen-ask-btn" onClick={handleAskAI} style={{ marginTop: 20 }}>
          💬 Спросить AI про алгоритм
          <span style={{ opacity: 0.4, fontSize: "11px" }}>→ Telegram</span>
        </button>

        {/* Delete */}
        <button
          class="algo-delete-btn"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Удаление..." : confirmDelete ? "Точно удалить?" : "Удалить алгоритм"}
        </button>
      </main>
    </div>
  );
}

