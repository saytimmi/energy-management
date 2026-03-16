import { CommandContext, Context } from "grammy";
import { config } from "../config.js";

const OWNER_TELEGRAM_ID = BigInt(process.env.OWNER_TELEGRAM_ID || "0");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = "saytimmi/energy-management";

export async function kaizenHandler(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;
  if (!from || BigInt(from.id) !== OWNER_TELEGRAM_ID) {
    await ctx.reply("Только владелец может запускать кайдзен.");
    return;
  }

  const args = ctx.message?.text?.replace("/kaizen", "").trim();

  if (args === "improve" || args === "улучши") {
    await triggerImprovement(ctx);
    return;
  }

  // Default: show diagnostics
  await showDiagnostics(ctx);
}

async function showDiagnostics(ctx: CommandContext<Context>): Promise<void> {
  try {
    const baseUrl = config.webappUrl || `http://localhost:${config.port}`;
    const res = await fetch(`${baseUrl}/api/kaizen`);

    if (!res.ok) {
      // Fallback: call local endpoint
      const localRes = await fetch(`http://localhost:${config.port}/api/kaizen`);
      if (!localRes.ok) throw new Error("Kaizen API unavailable");
      var data = await localRes.json();
    } else {
      var data = await res.json();
    }

    const lines: string[] = [];
    lines.push("📊 *Kaizen Report*\n");

    // Health
    const errCount = data.health?.errors24h || 0;
    lines.push(errCount === 0 ? "✅ Ошибок за 24ч: 0" : `⚠️ Ошибок за 24ч: ${errCount}`);

    if (data.health?.errorsBySource) {
      const sources = Object.entries(data.health.errorsBySource);
      if (sources.length > 0) {
        lines.push("  " + sources.map(([s, c]) => `${s}: ${c}`).join(", "));
      }
    }

    // Performance
    lines.push("");
    if (data.performance && Object.keys(data.performance).length > 0) {
      lines.push("⚡ *Перформанс:*");
      for (const [name, stats] of Object.entries(data.performance) as [string, any][]) {
        lines.push(`  ${name}: avg ${Math.round(stats.avg)}ms, max ${Math.round(stats.max)}ms (${stats.count}x)`);
      }
    }

    // Usage
    lines.push("");
    lines.push("👥 *Использование:*");
    lines.push(`  Пользователей: ${data.usage?.totalUsers || 0}`);
    lines.push(`  Активных сегодня: ${data.usage?.activeUsersToday || 0}`);
    lines.push(`  Сообщений сегодня: ${data.usage?.messagesToday || 0}`);
    lines.push(`  Голосовых: ${data.usage?.voiceMessagesToday || 0}`);
    lines.push(`  Наблюдений: ${data.usage?.observationsToday || 0}`);

    // Recent errors
    if (data.recentErrors?.length > 0) {
      lines.push("");
      lines.push("🐛 *Последние ошибки:*");
      for (const err of data.recentErrors.slice(0, 3)) {
        lines.push(`  \`${err.source}\`: ${err.message.slice(0, 80)}${err.count > 1 ? ` (x${err.count})` : ""}`);
      }
    }

    lines.push("");
    lines.push("💡 `/kaizen improve` — запустить улучшение");

    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Kaizen diagnostics error:", error);
    await ctx.reply("Не удалось получить диагностику. Проверь что сервер работает.");
  }
}

async function triggerImprovement(ctx: CommandContext<Context>): Promise<void> {
  if (!GITHUB_TOKEN) {
    await ctx.reply("❌ GITHUB_TOKEN не настроен. Добавь его в переменные окружения Railway.");
    return;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "kaizen-improve",
        client_payload: {
          triggered_by: "telegram",
          timestamp: new Date().toISOString(),
        },
      }),
    });

    if (res.status === 204 || res.ok) {
      await ctx.reply("🚀 Kaizen improvement запущен!\n\nClaude Code сейчас проанализирует код и сделает улучшение. Результат придёт коммитом в репо.");
    } else {
      const body = await res.text();
      await ctx.reply(`❌ Не удалось запустить: ${res.status}\n${body.slice(0, 200)}`);
    }
  } catch (error) {
    console.error("GitHub dispatch error:", error);
    await ctx.reply("❌ Ошибка при запуске GitHub Action.");
  }
}
