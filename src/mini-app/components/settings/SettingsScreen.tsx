import { useEffect, useState } from "preact/hooks";
import { settingsData, settingsLoading, loadSettings, updateSettings } from "../../store/settings";
import { haptic, hapticSuccess } from "../../telegram";
import { navigate } from "../../router";

const VACATION_PRESETS = [
  { days: 3, label: "3 дня" },
  { days: 7, label: "Неделя" },
  { days: 14, label: "2 недели" },
  { days: 30, label: "Месяц" },
];

export function SettingsScreen() {
  useEffect(() => { loadSettings(); }, []);

  const data = settingsData.value;
  const loading = settingsLoading.value;

  const handleBack = () => {
    haptic("light");
    navigate("hub");
  };

  if (loading && !data) {
    return (
      <div class="screen">
        <header class="app-header">
          <button class="back-btn" onClick={handleBack}>←</button>
          <h1 style={{ fontSize: "18px", fontWeight: 700 }}>Настройки</h1>
        </header>
        <main class="views" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
          Загрузка...
        </main>
      </div>
    );
  }

  if (!data) return null;

  const isOnVacation = data.vacationUntil && new Date(data.vacationUntil) > new Date();

  return (
    <div class="screen">
      <header class="app-header">
        <button class="back-btn" onClick={handleBack}>←</button>
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>Настройки</h1>
      </header>
      <main class="views">
        {/* Vacation section */}
        <div class="settings-section">
          <div class="settings-section-title">Режим паузы</div>
          {isOnVacation ? (
            <VacationActive
              until={data.vacationUntil!}
              reason={data.vacationReason}
            />
          ) : (
            <VacationInactive />
          )}
        </div>

        {/* Notifications */}
        <div class="settings-section">
          <div class="settings-section-title">Уведомления</div>
          <ToggleRow
            label="Утренний бриф"
            sublabel={`в ${data.notificationPrefs.morningTime}`}
            value={data.notificationPrefs.morningBrief}
            onChange={(v) => updateSettings({ notificationPrefs: { ...data.notificationPrefs, morningBrief: v } })}
          />
          <ToggleRow
            label="Дневное напоминание"
            sublabel="13:00"
            value={data.notificationPrefs.afternoonReminder}
            onChange={(v) => updateSettings({ notificationPrefs: { ...data.notificationPrefs, afternoonReminder: v } })}
          />
          <ToggleRow
            label="Вечернее напоминание"
            sublabel="20:30"
            value={data.notificationPrefs.eveningReminder}
            onChange={(v) => updateSettings({ notificationPrefs: { ...data.notificationPrefs, eveningReminder: v } })}
          />
          <ToggleRow
            label="Недельный дайджест"
            sublabel="воскресенье 20:00"
            value={data.notificationPrefs.weeklyDigest}
            onChange={(v) => updateSettings({ notificationPrefs: { ...data.notificationPrefs, weeklyDigest: v } })}
          />
          <ToggleRow
            label="Напоминание о балансе"
            sublabel={`каждые ${data.notificationPrefs.balanceIntervalDays} дней`}
            value={data.notificationPrefs.balanceReminder}
            onChange={(v) => updateSettings({ notificationPrefs: { ...data.notificationPrefs, balanceReminder: v } })}
          />
        </div>

        {/* Timezone */}
        <div class="settings-section">
          <div class="settings-section-title">Часовой пояс</div>
          <div class="settings-timezone">
            {data.timezone}
            <span style={{ fontSize: 12, color: "var(--text3)" }}>
              Изменить через бота: "я в Москве"
            </span>
          </div>
        </div>

        <div style={{ height: 80 }} />
      </main>
    </div>
  );
}

function VacationActive({ until, reason }: { until: string; reason: string | null }) {
  const [ending, setEnding] = useState(false);
  const untilDate = new Date(until).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

  const handleEnd = async () => {
    setEnding(true);
    haptic("medium");
    await updateSettings({ vacationUntil: null, vacationReason: null });
    hapticSuccess();
    setEnding(false);
  };

  return (
    <div class="settings-vacation-active">
      <div class="settings-vacation-badge">⏸ На паузе</div>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>
        {reason && <span>{reason} · </span>}до {untilDate}
      </div>
      <button class="settings-vacation-end-btn" onClick={handleEnd} disabled={ending}>
        {ending ? "..." : "Снять паузу"}
      </button>
    </div>
  );
}

function VacationInactive() {
  const [showPresets, setShowPresets] = useState(false);
  const [activating, setActivating] = useState(false);

  const handleActivate = async (days: number) => {
    setActivating(true);
    haptic("medium");
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await updateSettings({ vacationUntil: until, vacationReason: "пауза" });
    hapticSuccess();
    setActivating(false);
    setShowPresets(false);
  };

  if (showPresets) {
    return (
      <div class="settings-vacation-presets">
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>На сколько дней?</div>
        <div class="settings-vacation-preset-grid">
          {VACATION_PRESETS.map(p => (
            <button
              key={p.days}
              class="settings-vacation-preset-btn"
              onClick={() => handleActivate(p.days)}
              disabled={activating}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button class="settings-vacation-cancel" onClick={() => setShowPresets(false)}>
          Отмена
        </button>
      </div>
    );
  }

  return (
    <button class="settings-vacation-start-btn" onClick={() => { haptic("light"); setShowPresets(true); }}>
      ⏸ Поставить на паузу
    </button>
  );
}

function ToggleRow({ label, sublabel, value, onChange }: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div class="settings-toggle-row" onClick={() => { haptic("light"); onChange(!value); }}>
      <div>
        <div class="settings-toggle-label">{label}</div>
        {sublabel && <div class="settings-toggle-sublabel">{sublabel}</div>}
      </div>
      <div class={`settings-toggle${value ? " on" : ""}`}>
        <div class="settings-toggle-thumb" />
      </div>
    </div>
  );
}
