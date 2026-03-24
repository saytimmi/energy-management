import prisma from "../db.js";

export interface AwarenessGap {
  type:
    | "no_energy"
    | "no_balance"
    | "stale_balance"
    | "no_habits"
    | "no_mission"
    | "no_goals"
    | "no_reflection"
    | "empty_meaning"
    | "no_focus_areas"
    | "goal_without_habits"
    | "low_area_no_goal";
  priority: number;
  area?: string;
  suggestion: string;
  triggerContext?: string;
}

const AREA_LABELS: Record<string, string> = {
  health: "Здоровье", career: "Карьера", relationships: "Отношения",
  finances: "Финансы", family: "Семья", growth: "Развитие",
  recreation: "Отдых", environment: "Среда",
};

export async function getAwarenessGaps(userId: number): Promise<AwarenessGap[]> {
  const gaps: AwarenessGap[] = [];

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return gaps;

  const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // 1. no_energy (100)
  const latestEnergy = await prisma.energyLog.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestEnergy) {
    gaps.push({
      type: "no_energy",
      priority: 100,
      suggestion: "расскажи как ты себя чувствуешь — оценим энергию по 4 параметрам",
      triggerContext: "always",
    });
  }

  // 2. no_habits (90)
  const habitCount = await prisma.habit.count({
    where: { userId, isActive: true },
  });
  if (habitCount === 0 && latestEnergy) {
    gaps.push({
      type: "no_habits",
      priority: 90,
      suggestion: "у тебя пока нет привычек. давай создадим первую — что хочешь делать каждый день?",
      triggerContext: "after_checkin",
    });
  }

  // 3. no_balance (80)
  const latestBalance = await prisma.balanceRating.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestBalance && accountAgeDays >= 3) {
    gaps.push({
      type: "no_balance",
      priority: 80,
      suggestion: "ты ещё не оценивал баланс жизни. это 8 быстрых вопросов — даст полную картину",
      triggerContext: "end_of_conversation",
    });
  }

  // 4. stale_balance (70)
  if (latestBalance) {
    const daysSince = Math.floor((Date.now() - latestBalance.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 14) {
      gaps.push({
        type: "stale_balance",
        priority: 70,
        suggestion: `баланс жизни не обновлялся ${daysSince} дней. обновим? быстро 8 вопросов`,
        triggerContext: "end_of_conversation",
      });
    }
  }

  // 5. no_mission (60)
  const mission = await prisma.mission.findUnique({ where: { userId } });
  if (!mission?.statement && accountAgeDays >= 14) {
    gaps.push({
      type: "no_mission",
      priority: 60,
      suggestion: "у тебя нет сформулированной миссии. это 3 простых вопроса — за 5 минут определим направление",
      triggerContext: "reflection",
    });
  }

  // 6. no_goals (55)
  const activeGoals = await prisma.goal.findMany({
    where: { userId, status: "active" },
  });
  if (activeGoals.length === 0 && (mission?.statement || accountAgeDays >= 21)) {
    gaps.push({
      type: "no_goals",
      priority: 55,
      suggestion: "пока нет конкретных целей. давай поставим хотя бы одну на этот квартал?",
      triggerContext: "after_mission",
    });
  }

  // 7. no_reflection (52)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterdayReflection = await prisma.reflection.findFirst({
    where: { userId, date: { gte: yesterday, lt: today } },
  });
  if (!yesterdayReflection && latestEnergy) {
    gaps.push({
      type: "no_reflection",
      priority: 52,
      suggestion: "рефлексия за вчера не пройдена. расскажи что было самым важным?",
      triggerContext: "morning",
    });
  }

  // 8. empty_meaning (50)
  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true },
  });
  const habitsWithoutMeaning = habits.filter(
    h => h.type === "build" && !h.whyToday && !h.whyIdentity
  );
  if (habitsWithoutMeaning.length > 0) {
    const first = habitsWithoutMeaning[0];
    gaps.push({
      type: "empty_meaning",
      priority: 50,
      suggestion: `привычка "${first.name}" без смысла — зачем тебе ${first.name}?`,
      triggerContext: "reflection",
    });
  }

  // 9. goal_without_habits (45)
  for (const goal of activeGoals) {
    const areaHabits = habits.filter(h => h.lifeArea === goal.lifeArea);
    if (areaHabits.length === 0) {
      const label = AREA_LABELS[goal.lifeArea] || goal.lifeArea;
      gaps.push({
        type: "goal_without_habits",
        priority: 45,
        area: goal.lifeArea,
        suggestion: `цель "${goal.title}" (${label}) есть, но привычек для неё нет. создадим?`,
        triggerContext: "after_goals",
      });
      break;
    }
  }

  // 10. no_focus_areas (40)
  const balanceGoals = await prisma.balanceGoal.findMany({ where: { userId } });
  const hasFocus = balanceGoals.some(bg => bg.isFocus);
  if (latestBalance && !hasFocus) {
    gaps.push({
      type: "no_focus_areas",
      priority: 40,
      suggestion: "баланс оценён, но фокус-сферы не выбраны. какие 2-3 сферы хочешь подтянуть?",
      triggerContext: "after_balance",
    });
  }

  // 11. low_area_no_goal (35)
  if (latestBalance) {
    const areas = ["health", "career", "relationships", "finances", "family", "growth", "recreation", "environment"];
    for (const area of areas) {
      const rating = await prisma.balanceRating.findFirst({
        where: { userId, area },
        orderBy: { createdAt: "desc" },
      });
      if (rating && rating.score <= 4) {
        const hasGoal = activeGoals.some(g => g.lifeArea === area);
        if (!hasGoal) {
          const label = AREA_LABELS[area] || area;
          gaps.push({
            type: "low_area_no_goal",
            priority: 35,
            area,
            suggestion: `${label} на ${rating.score}/10 — может поставим цель для улучшения?`,
            triggerContext: "after_balance",
          });
          break;
        }
      }
    }
  }

  gaps.sort((a, b) => b.priority - a.priority);
  return gaps;
}

export async function getAwarenessContext(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  if ((user as any).vacationUntil && (user as any).vacationUntil > new Date()) {
    return null;
  }

  const gaps = await getAwarenessGaps(userId);
  if (gaps.length === 0) return null;

  const lines: string[] = ["ПРОБЕЛЫ В ДАННЫХ (предложи заполнить когда уместно, НЕ в первом сообщении, а в конце разговора или при уместном моменте):"];

  for (const gap of gaps.slice(0, 3)) {
    lines.push(`- ${gap.suggestion}`);
  }

  return lines.join("\n");
}

/**
 * Check if user is currently on vacation.
 */
export function isOnVacation(user: { vacationUntil: Date | null }): boolean {
  return !!(user.vacationUntil && user.vacationUntil > new Date());
}
