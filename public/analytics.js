// Analytics module — AI-generated energy pattern insights
(function () {
  var analyticsCache = null;
  var analyticsLoaded = false;

  window.initAnalytics = function (telegramId) {
    // Cache results — don't refetch if already loaded
    if (analyticsLoaded) return;

    var loadingEl = document.getElementById("analyticsLoading");
    var noDataEl = document.getElementById("analyticsNoData");
    var noDataMsgEl = document.getElementById("analyticsNoDataMsg");
    var contentEl = document.getElementById("analyticsContent");
    var insightsListEl = document.getElementById("insightsList");
    var statsMetaEl = document.getElementById("statsMeta");

    // Show loading
    loadingEl.classList.remove("hidden");
    noDataEl.classList.add("hidden");
    contentEl.classList.add("hidden");

    fetch("/api/analytics?telegramId=" + telegramId)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        loadingEl.classList.add("hidden");
        analyticsLoaded = true;
        analyticsCache = data;

        if (!data.hasEnoughData) {
          // Not enough data
          noDataEl.classList.remove("hidden");
          noDataMsgEl.textContent = data.message || "Недостаточно данных для анализа";
          return;
        }

        // Show content
        contentEl.classList.remove("hidden");

        // Render stats
        renderStats(data.stats);

        // Render meta info
        statsMetaEl.textContent = data.stats.totalLogs + " записей за " + data.stats.periodDays + " дней";

        // Render insights
        if (data.insights && data.error !== "ai_unavailable") {
          renderInsights(data.insights, insightsListEl);
        } else {
          insightsListEl.innerHTML = '<div class="insight-card insight-unavailable">' +
            '<p>AI-анализ временно недоступен</p></div>';
        }
      })
      .catch(function () {
        loadingEl.classList.add("hidden");
        noDataEl.classList.remove("hidden");
        noDataMsgEl.textContent = "Не удалось загрузить аналитику";
      });
  };

  function renderStats(stats) {
    var types = [
      { key: "physical", stat: "avgPhysical" },
      { key: "mental", stat: "avgMental" },
      { key: "emotional", stat: "avgEmotional" },
      { key: "spiritual", stat: "avgSpiritual" }
    ];

    types.forEach(function (t) {
      var card = document.querySelector('.stat-card[data-stat="' + t.key + '"]');
      if (card) {
        var valueEl = card.querySelector(".stat-value");
        valueEl.textContent = stats[t.stat];
      }
    });
  }

  function renderInsights(insightsText, container) {
    // Parse numbered list from AI response
    var lines = insightsText.split("\n").filter(function (line) {
      return line.trim().length > 0;
    });

    var insights = [];
    var current = "";

    lines.forEach(function (line) {
      var trimmed = line.trim();
      // Check if line starts with a number (e.g., "1.", "1)", "1 -")
      if (/^\d+[\.\)\-\s]/.test(trimmed)) {
        if (current) insights.push(current);
        current = trimmed.replace(/^\d+[\.\)\-\s]+/, "").trim();
      } else if (current) {
        current += " " + trimmed;
      } else {
        current = trimmed;
      }
    });
    if (current) insights.push(current);

    // If no numbered items found, treat entire text as single insight
    if (insights.length === 0) {
      insights = [insightsText.trim()];
    }

    var html = insights.map(function (insight, index) {
      return '<div class="insight-card" style="animation-delay: ' + (index * 0.1) + 's">' +
        '<span class="insight-number">' + (index + 1) + '</span>' +
        '<p class="insight-text">' + escapeHtml(insight) + '</p>' +
        '</div>';
    }).join("");

    container.innerHTML = html;
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
})();
