document.addEventListener("DOMContentLoaded", function () {
  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) { tg.ready(); tg.expand(); }

  var telegramId = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : null;

  if (!telegramId) {
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("welcome").classList.remove("hidden");
    document.querySelector(".welcome-content p").textContent = "Откройте через Telegram бота";
    return;
  }

  // Set date
  var now = new Date();
  var dateEl = document.getElementById("currentDate");
  dateEl.textContent = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });

  // Greeting based on time
  var hour = now.getHours();
  var greetingEl = document.getElementById("greetingText");
  if (hour < 6) greetingEl.textContent = "Доброй ночи,";
  else if (hour < 12) greetingEl.textContent = "Доброе утро,";
  else if (hour < 18) greetingEl.textContent = "Добрый день,";
  else greetingEl.textContent = "Добрый вечер,";

  var userName = tg.initDataUnsafe.user.first_name || "";
  document.getElementById("userName").textContent = userName;

  // Load all data
  Promise.all([
    fetch("/api/dashboard?telegramId=" + telegramId).then(r => r.json()),
    fetch("/api/observations?telegramId=" + telegramId).then(r => r.json()),
  ]).then(function (results) {
    var dashboard = results[0];
    var obsData = results[1];

    document.getElementById("loading").classList.add("hidden");

    var hasNoData = (dashboard.error === "no_data" || dashboard.error === "user_not_found") && obsData.stats && obsData.stats.total === 0;

    if (hasNoData) {
      document.getElementById("welcome").classList.remove("hidden");
      return;
    }

    document.getElementById("main").classList.remove("hidden");

    // Render energy rings or empty state
    if (!dashboard.error) {
      renderRings(dashboard);
      // Show streak badge
      if (dashboard.streak && dashboard.streak > 0) {
        var streakEl = document.getElementById("streakBadge");
        streakEl.textContent = "\uD83D\uDD25 " + dashboard.streak + " " + getDayWord(dashboard.streak) + " подряд";
        streakEl.classList.remove("hidden");
      }
    } else {
      // Dashboard has error but we have observations — show empty energy state
      document.querySelector(".energy-rings").insertAdjacentHTML("afterend",
        '<div class="dashboard-empty-msg">\u0420\u0430\u0441\u0441\u043A\u0430\u0436\u0438 \u0431\u043E\u0442\u0443 \u043A\u0430\u043A \u0442\u044B \u0441\u0435\u0431\u044F \u0447\u0443\u0432\u0441\u0442\u0432\u0443\u0435\u0448\u044C \u2014 \u044F \u043D\u0430\u0447\u043D\u0443 \u043E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u0442\u044C \uD83C\uDF31</div>');
    }

    // Render observations
    renderObservations(obsData);

    // Load analytics if 3+ logs
    if (obsData.stats && obsData.stats.total >= 3) {
      loadAnalytics();
    }

    // Quick check-in button
    var checkinBtn = document.getElementById("quickCheckinBtn");
    checkinBtn.addEventListener("click", function () {
      checkinBtn.disabled = true;
      checkinBtn.textContent = "Отправляю...";
      fetch("/api/checkin-trigger?telegramId=" + telegramId)
        .then(function () {
          checkinBtn.textContent = "✓ Бот напишет тебе";
          setTimeout(function () {
            checkinBtn.disabled = false;
            checkinBtn.textContent = "⚡ Записать энергию";
          }, 3000);
        })
        .catch(function () {
          checkinBtn.disabled = false;
          checkinBtn.textContent = "⚡ Записать энергию";
        });
    });

  }).catch(function () {
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("welcome").classList.remove("hidden");
    document.querySelector(".welcome-content p").textContent = "Не удалось загрузить данные";
  });

  // Navigation
  document.querySelectorAll(".nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.dataset.view;
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
      var viewEl = document.getElementById(target);
      if (viewEl) viewEl.classList.remove("hidden");

      if (target === "v-timeline") loadTimeline("week");
      if (target === "v-journal") loadJournal();
    });
  });

  // Period pills
  document.querySelectorAll(".pill").forEach(function (pill) {
    pill.addEventListener("click", function () {
      document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      loadTimeline(pill.dataset.period);
    });
  });

  function getDayWord(n) {
    var abs = Math.abs(n) % 100;
    var last = abs % 10;
    if (abs > 10 && abs < 20) return "дней";
    if (last > 1 && last < 5) return "дня";
    if (last === 1) return "день";
    return "дней";
  }

  function loadAnalytics() {
    fetch("/api/analytics?telegramId=" + telegramId)
      .then(r => r.json())
      .then(function (data) {
        if (!data || !data.insights) return;
        var section = document.getElementById("analyticsSection");
        var content = document.getElementById("analyticsContent");
        var insights = Array.isArray(data.insights) ? data.insights : [data.insights];
        content.innerHTML = insights.map(function (insight) {
          return '<div class="analytics-card">' + insight + '</div>';
        }).join("");
        section.classList.remove("hidden");
      })
      .catch(function () { /* silently skip */ });
  }

  function renderRings(data) {
    var types = ["physical", "mental", "emotional", "spiritual"];
    types.forEach(function (type, i) {
      var card = document.querySelector('.ring-card[data-type="' + type + '"]');
      var val = data[type] || 0;
      var fill = card.querySelector(".ring-fill");
      var valEl = card.querySelector(".ring-val");

      valEl.textContent = val;
      var circumference = 264;
      var offset = circumference - (val / 10) * circumference;
      setTimeout(function () {
        fill.style.strokeDashoffset = offset;
      }, i * 120);
    });

    if (data.loggedAt) {
      var d = new Date(data.loggedAt);
      document.getElementById("lastUpdate").textContent =
        "Обновлено " + d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    }
  }

  function renderObservations(data) {
    var list = document.getElementById("obsList");
    var section = document.getElementById("obsSection");

    if (!data.observations || data.observations.length === 0) {
      section.classList.add("hidden");
      return;
    }

    var emojiMap = { physical: "🏃", mental: "🧠", emotional: "💚", spiritual: "🔮" };
    var typeNames = { physical: "Физическая", mental: "Ментальная", emotional: "Эмоциональная", spiritual: "Духовная" };
    var dirNames = { drop: "просадка", rise: "рост", low: "низкая", high: "высокая", stable: "стабильно" };

    var recent = data.observations.slice(0, 6);
    list.innerHTML = recent.map(function (o, i) {
      var emoji = emojiMap[o.energyType] || "•";
      var text = o.context || o.trigger || typeNames[o.energyType] + " — " + (dirNames[o.direction] || o.direction);
      var time = new Date(o.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
      var tag = '<span class="obs-tag ' + o.direction + '">' + (dirNames[o.direction] || o.direction) + '</span>';

      return '<div class="obs-item" style="animation-delay:' + (i * 0.06) + 's">' +
        '<span class="obs-emoji">' + emoji + '</span>' +
        '<div class="obs-body">' +
          '<div class="obs-text">' + text + '</div>' +
          '<div class="obs-meta">' + tag + '<span>' + time + '</span></div>' +
        '</div></div>';
    }).join("");
  }

  var chartInstance = null;

  function loadTimeline(period) {
    var canvas = document.getElementById("historyChart");
    var emptyEl = document.getElementById("timelineEmpty");
    emptyEl.classList.add("hidden");

    fetch("/api/history?telegramId=" + telegramId + "&period=" + period)
      .then(r => r.json())
      .then(function (data) {
        if (!data || data.length === 0) {
          if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
          emptyEl.classList.remove("hidden");
          return;
        }

        var labels = data.map(d => {
          var dt = new Date(d.date);
          return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
        });

        var datasets = [
          { label: "🏃 Физ", data: data.map(d => d.physical), borderColor: "#5be07a", backgroundColor: "rgba(91,224,122,0.1)", tension: 0.4, borderWidth: 2, pointRadius: 3 },
          { label: "🧠 Мент", data: data.map(d => d.mental), borderColor: "#5ba8ff", backgroundColor: "rgba(91,168,255,0.1)", tension: 0.4, borderWidth: 2, pointRadius: 3 },
          { label: "💚 Эмоц", data: data.map(d => d.emotional), borderColor: "#ff8c5b", backgroundColor: "rgba(255,140,91,0.1)", tension: 0.4, borderWidth: 2, pointRadius: 3 },
          { label: "🔮 Дух", data: data.map(d => d.spiritual), borderColor: "#c77dff", backgroundColor: "rgba(199,125,255,0.1)", tension: 0.4, borderWidth: 2, pointRadius: 3 },
        ];

        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(canvas, {
          type: "line",
          data: { labels: labels, datasets: datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { min: 0, max: 10, ticks: { color: "#8a8690", stepSize: 2 }, grid: { color: "rgba(255,255,255,0.05)" } },
              x: { ticks: { color: "#8a8690", maxRotation: 0, font: { size: 10 } }, grid: { display: false } },
            },
            plugins: {
              legend: { position: "bottom", labels: { color: "#8a8690", padding: 16, font: { size: 11 } } },
            },
            interaction: { intersect: false, mode: "index" },
          },
        });
      });
  }

  function loadJournal() {
    var list = document.getElementById("journalList");

    fetch("/api/observations?telegramId=" + telegramId)
      .then(r => r.json())
      .then(function (data) {
        if (!data.observations || data.observations.length === 0) {
          list.innerHTML = '<div class="journal-empty-state">' +
            '<div class="journal-empty-icon">📝</div>' +
            '<p>Твой дневник энергии пока пуст. Каждый разговор с ботом добавит запись сюда</p>' +
          '</div>';
          return;
        }

        var grouped = data.grouped;
        var typeNames = { physical: "Физическая", mental: "Ментальная", emotional: "Эмоциональная", spiritual: "Духовная" };

        // Get today's date key for highlighting
        var todayKey = new Date().toISOString().split("T")[0];

        var html = Object.entries(grouped)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(function (entry) {
            var dateKey = entry[0];
            var obs = entry[1];
            var isToday = dateKey === todayKey;
            var dateStr = new Date(dateKey).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
            var dateLabel = isToday ? "Сегодня" : dateStr;

            var entries = obs.map(function (o) {
              var time = new Date(o.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
              var rec = o.recommendation ? '<div class="journal-rec">💡 ' + o.recommendation + '</div>' : '';
              var trigger = o.trigger ? '<div class="journal-trigger">Причина: ' + o.trigger + '</div>' : '';

              return '<div class="journal-entry" data-type="' + o.energyType + '">' +
                '<div class="journal-entry-header">' +
                  '<span class="journal-type">' + (typeNames[o.energyType] || o.energyType) + '</span>' +
                  '<span class="journal-time">' + time + '</span>' +
                '</div>' +
                '<div class="journal-context">' + (o.context || o.direction) + '</div>' +
                trigger + rec +
              '</div>';
            }).join("");

            return '<div class="journal-day' + (isToday ? ' journal-today' : '') + '">' +
              '<div class="journal-date' + (isToday ? ' journal-date-today' : '') + '">' + dateLabel + '</div>' +
              '<div class="journal-entries">' + entries + '</div>' +
            '</div>';
          }).join("");

        list.innerHTML = html;
      });
  }
});
