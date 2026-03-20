interface StageIndicatorProps {
  stage: "seed" | "growth" | "autopilot";
  createdAt: string;
}

const STAGE_CONFIG = {
  seed: { emoji: "🌱", label: "Зерно", targetDays: 21 },
  growth: { emoji: "🌿", label: "Рост", targetDays: 60 },
  autopilot: { emoji: "🌳", label: "Автопилот", targetDays: 0 },
};

export function StageIndicator({ stage, createdAt }: StageIndicatorProps) {
  const config = STAGE_CONFIG[stage];
  const daysSinceCreation = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  const progress = config.targetDays > 0 ? Math.min(daysSinceCreation / config.targetDays, 1) : 1;

  return (
    <div class="stage-indicator">
      <div class="stage-emoji">{config.emoji}</div>
      <div class="stage-label">{config.label}</div>
      <div style={{ fontSize: "12px", opacity: 0.6 }}>
        {daysSinceCreation} {getDayWord(daysSinceCreation)}
        {config.targetDays > 0 && ` / ${config.targetDays}`}
      </div>
      <div class="stage-progress">
        <div
          class="stage-progress-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {stage === "autopilot" && (
        <div style={{ fontSize: "12px", marginTop: "4px" }}>✨ Привычка закреплена</div>
      )}
    </div>
  );
}

function getDayWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "дней";
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
}
