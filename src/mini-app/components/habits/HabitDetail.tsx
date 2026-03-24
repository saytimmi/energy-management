import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import type { HabitData, HabitStats } from "../../api/types";
import { api } from "../../api/client";
import { Skeleton } from "../shared/Skeleton";
import { updateHabit, deleteHabit, pauseHabit, resumeHabit, loadHabits } from "../../store/habits";
import { haptic, hapticSuccess } from "../../telegram";
import { StageIndicator } from "./StageIndicator";
import { CorrelationCard } from "./CorrelationCard";

interface HabitDetailProps {
  habit: HabitData;
  onBack: () => void;
}

const stats = signal<HabitStats | null>(null);
const statsLoading = signal(true);

export function HabitDetail({ habit, onBack }: HabitDetailProps) {
  const [editingWhy, setEditingWhy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPauseOptions, setShowPauseOptions] = useState(false);
  const [pausing, setPausing] = useState(false);

  // Meaning fields (build)
  const [whyToday, setWhyToday] = useState(habit.whyToday || "");
  const [whyMonth, setWhyMonth] = useState(habit.whyMonth || "");
  const [whyYear, setWhyYear] = useState(habit.whyYear || "");
  const [whyIdentity, setWhyIdentity] = useState(habit.whyIdentity || "");

  // Meaning fields (break)
  const [isItBeneficial, setIsItBeneficial] = useState(habit.isItBeneficial || "");
  const [breakTrigger, setBreakTrigger] = useState(habit.breakTrigger || "");
  const [replacement, setReplacement] = useState(habit.replacement || "");

  useEffect(() => {
    statsLoading.value = true;
    stats.value = null;
    api.habitStats(habit.id)
      .then((data) => { stats.value = data; })
      .catch((err) => { console.error("Failed to load habit stats:", err); })
      .finally(() => { statsLoading.value = false; });
  }, [habit.id]);

  // Auto-open edit if no meaning filled yet
  useEffect(() => {
    if (!hasAnyWhy(habit)) {
      setEditingWhy(true);
    }
  }, []);

  function handleBack() {
    haptic("light");
    onBack();
  }

  async function handleSaveWhy() {
    setSaving(true);
    haptic("medium");

    const data = habit.type === "build"
      ? { whyToday, whyMonth, whyYear, whyIdentity }
      : { isItBeneficial, breakTrigger, replacement };

    const result = await updateHabit(habit.id, data);
    setSaving(false);

    if (result) {
      hapticSuccess();
      setEditingWhy(false);
      // Update local habit data
      if (habit.type === "build") {
        habit.whyToday = whyToday;
        habit.whyMonth = whyMonth;
        habit.whyYear = whyYear;
        habit.whyIdentity = whyIdentity;
      } else {
        habit.isItBeneficial = isItBeneficial;
        habit.breakTrigger = breakTrigger;
        habit.replacement = replacement;
      }
    }
  }

  const s = stats.value;
  const isBuild = habit.type === "build";

  return (
    <div class="habit-detail">
      <div class="habit-detail-header">
        <button class="habit-detail-back" onClick={handleBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="habit-detail-name">{habit.icon} {habit.name}</div>
      </div>

      <StageIndicator stage={habit.stage} createdAt={habit.createdAt} />

      {/* Pause banner */}
      {habit.isPaused && (
        <div class="pause-banner">
          <span>⏸ На паузе{habit.pausedUntil ? ` до ${new Date(habit.pausedUntil).toLocaleDateString("ru")}` : ""}</span>
          <button class="pause-resume-btn" onClick={async () => {
            haptic("medium");
            await resumeHabit(habit.id);
            onBack();
          }}>▶ Возобновить</button>
        </div>
      )}

      {/* Meaning Framework — always first */}
      <div class="detail-section-title">Зачем это тебе</div>
      <div class="detail-why">
        {editingWhy ? (
          /* Edit mode */
          <div class="meaning-edit">
            {isBuild ? (
              <>
                <MeaningField
                  label="Выгода сегодня"
                  placeholder="Что получаешь, когда делаешь это?"
                  value={whyToday}
                  onInput={setWhyToday}
                />
                <MeaningField
                  label="Через месяц"
                  placeholder="Как изменится жизнь через месяц?"
                  value={whyMonth}
                  onInput={setWhyMonth}
                />
                <MeaningField
                  label="Через год"
                  placeholder="Кем ты станешь через год?"
                  value={whyYear}
                  onInput={setWhyYear}
                />
                <MeaningField
                  label="Версия себя"
                  placeholder="Какой ты, когда это привычка?"
                  value={whyIdentity}
                  onInput={setWhyIdentity}
                />
              </>
            ) : (
              <>
                <MeaningField
                  label="Выгодно ли это организму?"
                  placeholder="Будь честен с собой"
                  value={isItBeneficial}
                  onInput={setIsItBeneficial}
                />
                <MeaningField
                  label="Что триггерит?"
                  placeholder="Что запускает эту привычку?"
                  value={breakTrigger}
                  onInput={setBreakTrigger}
                />
                <MeaningField
                  label="Что вместо?"
                  placeholder="Какое действие заменит?"
                  value={replacement}
                  onInput={setReplacement}
                />
              </>
            )}
            <div class="meaning-edit-actions">
              <button
                class="meaning-save-btn"
                onClick={handleSaveWhy}
                disabled={saving}
              >
                {saving ? "Сохраняю..." : "Сохранить"}
              </button>
              {hasAnyWhy(habit) && (
                <button
                  class="meaning-cancel-btn"
                  onClick={() => setEditingWhy(false)}
                >
                  Отмена
                </button>
              )}
            </div>
          </div>
        ) : (
          /* View mode */
          <>
            {isBuild ? (
              <>
                {habit.whyToday && <WhyItem label="Сегодня" value={habit.whyToday} />}
                {habit.whyMonth && <WhyItem label="Месяц" value={habit.whyMonth} />}
                {habit.whyYear && <WhyItem label="Год" value={habit.whyYear} />}
                {habit.whyIdentity && <WhyItem label="Идентичность" value={habit.whyIdentity} />}
              </>
            ) : (
              <>
                {habit.isItBeneficial && <WhyItem label="Польза?" value={habit.isItBeneficial} />}
                {habit.breakTrigger && <WhyItem label="Триггер" value={habit.breakTrigger} />}
                {habit.replacement && <WhyItem label="Замена" value={habit.replacement} />}
              </>
            )}
            <button
              class="meaning-edit-btn"
              onClick={() => { haptic("light"); setEditingWhy(true); }}
            >
              ✏️ {hasAnyWhy(habit) ? "Редактировать" : "Добавить смысл"}
            </button>
          </>
        )}
      </div>

      {/* Strength bar */}
      <div class="strength-section">
        <div class="strength-header">
          <span class="strength-label">Сила привычки</span>
          <span class="strength-value">{Math.round(habit.strength ?? 0)}%</span>
        </div>
        <div class="strength-bar-bg">
          <div class="strength-bar-fill" style={{ width: `${Math.min(100, habit.strength ?? 0)}%` }} />
        </div>
      </div>

      <div class="detail-stats">
        <div>🔥 {s?.streakCurrent ?? habit.streakCurrent} дней (лучший: {s?.streakBest ?? habit.streakBest})</div>
        <div>📊 {s?.consistency30d ?? habit.consistency30d}% за месяц</div>
        <div>❄️ {s ? s.freezesRemaining : Math.max(0, (habit.gracePeriod ?? 2) - (habit.gracesUsed ?? 0))} пропусков осталось на неделе</div>
      </div>

      {/* Duration info */}
      {habit.duration && (
        <div class="detail-duration-info">
          {habit.duration < 60 ? `${habit.duration} мин` : `${Math.floor(habit.duration / 60)} ч${habit.duration % 60 ? ` ${habit.duration % 60} мин` : ""}`}
          {habit.isDuration ? " (с таймером)" : ""}
        </div>
      )}

      {/* Heatmap */}
      <div class="detail-section-title">Месяц</div>
      {statsLoading.value ? (
        <div style={{ padding: "20px" }}>
          <Skeleton width="60%" height="18px" style={{ marginBottom: "16px" }} />
          <Skeleton width="100%" height="12px" style={{ marginBottom: "8px" }} />
          <Skeleton width="80%" height="12px" />
        </div>
      ) : s?.heatmap ? (
        <MonthHeatmap heatmap={s.heatmap} />
      ) : (
        <div style={{ textAlign: "center", padding: "20px", opacity: 0.5 }}>Нет данных</div>
      )}

      <CorrelationCard habitId={habit.id} />

      {/* Pause */}
      {!habit.isPaused && (
        <div class="habit-pause-section">
          {showPauseOptions ? (
            <div class="pause-options">
              <div class="pause-options-title">На сколько дней?</div>
              <div class="pause-options-btns">
                {[3, 7, 14, 30].map(days => (
                  <button
                    key={days}
                    class="pause-option-btn"
                    disabled={pausing}
                    onClick={async () => {
                      setPausing(true);
                      haptic("medium");
                      await pauseHabit(habit.id, days);
                      setPausing(false);
                      onBack();
                    }}
                  >
                    {days}д
                  </button>
                ))}
              </div>
              <button class="pause-cancel-btn" onClick={() => setShowPauseOptions(false)}>Отмена</button>
            </div>
          ) : (
            <button class="habit-pause-btn" onClick={() => { haptic("light"); setShowPauseOptions(true); }}>
              ⏸ Поставить на паузу
            </button>
          )}
        </div>
      )}

      {/* Delete */}
      <div class="habit-delete-section">
        {confirmDelete ? (
          <div class="habit-delete-confirm">
            <div class="habit-delete-confirm-text">Удалить «{habit.name}»?</div>
            <div class="habit-delete-confirm-actions">
              <button
                class="habit-delete-confirm-yes"
                onClick={async () => {
                  setDeleting(true);
                  haptic("heavy");
                  const ok = await deleteHabit(habit.id);
                  setDeleting(false);
                  if (ok) onBack();
                }}
                disabled={deleting}
              >
                {deleting ? "Удаляю..." : "Да, удалить"}
              </button>
              <button
                class="habit-delete-confirm-no"
                onClick={() => { setConfirmDelete(false); haptic("light"); }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            class="habit-delete-btn"
            onClick={() => { setConfirmDelete(true); haptic("medium"); }}
          >
            Удалить привычку
          </button>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function WhyItem({ label, value }: { label: string; value: string }) {
  return (
    <div class="detail-why-item">
      <div class="detail-why-label">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function MeaningField({ label, placeholder, value, onInput }: {
  label: string;
  placeholder: string;
  value: string;
  onInput: (v: string) => void;
}) {
  return (
    <div class="meaning-field">
      <label class="meaning-field-label">{label}</label>
      <input
        class="form-input"
        type="text"
        value={value}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function hasAnyWhy(h: HabitData): boolean {
  return !!(h.whyToday || h.whyMonth || h.whyYear || h.whyIdentity || h.isItBeneficial || h.breakTrigger || h.replacement);
}

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function MonthHeatmap({ heatmap }: { heatmap: Array<{ date: string; completed: boolean }> }) {
  const today = new Date().toISOString().slice(0, 10);

  // Build calendar grid aligned to weekdays
  const firstDate = new Date(heatmap[0].date);
  // JS: 0=Sun, we want 0=Mon
  const firstDow = (firstDate.getDay() + 6) % 7;

  // Create data map
  const dataMap = new Map(heatmap.map(d => [d.date, d.completed]));

  // Pad start with empty cells
  const cells: Array<{ date: string; completed: boolean; dayNum: number } | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (const d of heatmap) {
    cells.push({ date: d.date, completed: d.completed, dayNum: parseInt(d.date.slice(8)) });
  }

  return (
    <div class="month-heatmap">
      <div class="month-heatmap-header">
        {DAY_NAMES.map(d => <div key={d} class="month-heatmap-day-name">{d}</div>)}
      </div>
      <div class="month-heatmap-grid">
        {cells.map((cell, i) =>
          cell ? (
            <div
              key={cell.date}
              class={`month-heatmap-cell${cell.completed ? " done" : ""}${cell.date === today ? " today" : ""}`}
            >
              {cell.dayNum}
            </div>
          ) : (
            <div key={`empty-${i}`} class="month-heatmap-cell empty" />
          )
        )}
      </div>
    </div>
  );
}
