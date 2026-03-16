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
    document.querySelector(".welcome-content").innerHTML =
      '<div class="welcome-icon">😔</div>' +
      '<h1>Не удалось загрузить</h1>' +
      '<p>Проверь соединение и попробуй снова</p>' +
      '<button class="retry-btn" onclick="location.reload()">🔄 Повторить</button>';
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

        // Split insights by numbered lines and render as cards
        var text = Array.isArray(data.insights) ? data.insights.join("\n") : data.insights;
        var items = text.split(/\n(?=\d+\.)/).filter(function (s) { return s.trim(); });

        if (items.length <= 1) {
          // Single block — render with basic formatting
          content.innerHTML = '<div class="analytics-card">' + formatInsight(text) + '</div>';
        } else {
          content.innerHTML = items.map(function (item) {
            return '<div class="analytics-card">' + formatInsight(item.trim()) + '</div>';
          }).join("");
        }
        section.classList.remove("hidden");
      })
      .catch(function () { /* silently skip */ });
  }

  function formatInsight(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
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
    var dirNames = { drop: "↓ просадка", rise: "↑ рост", low: "↓ низкая", high: "↑ высокая", stable: "— стабильно" };
    var dirIcons = { drop: "🔻", rise: "🔺", low: "🔻", high: "🔺", stable: "➖" };

    // Group recent observations by energy type — show latest per type
    var byType = {};
    data.observations.forEach(function (o) {
      if (!byType[o.energyType]) byType[o.energyType] = o;
    });

    // Also get today's observations for "Сегодня" section
    var todayKey = new Date().toISOString().split("T")[0];
    var todayObs = data.observations.filter(function (o) {
      return o.createdAt.split("T")[0] === todayKey;
    });

    var html = "";

    // Today's summary card
    if (todayObs.length > 0) {
      html += '<div class="obs-today-card">';
      html += '<div class="obs-today-title">Сегодня</div>';
      html += '<div class="obs-today-items">';
      todayObs.forEach(function (o) {
        var emoji = emojiMap[o.energyType] || "•";
        var icon = dirIcons[o.direction] || "";
        var text = o.trigger || o.context || "";
        html += '<div class="obs-today-item">' +
          '<span>' + emoji + ' ' + icon + '</span>' +
          '<span class="obs-today-text">' + text + '</span>' +
        '</div>';
      });
      html += '</div></div>';
    }

    // Recent notable events (drops and rises only, last 5)
    var notable = data.observations
      .filter(function (o) { return o.direction === "drop" || o.direction === "rise" || o.direction === "low"; })
      .slice(0, 5);

    if (notable.length > 0) {
      notable.forEach(function (o, i) {
        var emoji = emojiMap[o.energyType] || "•";
        var text = o.context || o.trigger || "";
        var tag = '<span class="obs-tag ' + o.direction + '">' + (dirNames[o.direction] || o.direction) + '</span>';
        var timeAgo = getTimeAgo(new Date(o.createdAt));

        html += '<div class="obs-item" style="animation-delay:' + (i * 0.06) + 's">' +
          '<span class="obs-emoji">' + emoji + '</span>' +
          '<div class="obs-body">' +
            '<div class="obs-text">' + text + '</div>' +
            '<div class="obs-meta">' + tag + '<span>' + timeAgo + '</span></div>' +
          '</div></div>';
      });
    }

    if (html === "") {
      section.classList.add("hidden");
      return;
    }

    list.innerHTML = html;
  }

  function getTimeAgo(date) {
    var now = new Date();
    var diff = now - date;
    var mins = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);

    if (mins < 1) return "только что";
    if (mins < 60) return mins + " мин назад";
    if (hours < 24) return hours + " ч назад";
    if (days === 1) return "вчера";
    if (days < 7) return days + " дн назад";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
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

        var emojiMap = { physical: "🏃", mental: "🧠", emotional: "💚", spiritual: "🔮" };
        var typeNames = { physical: "Физическая", mental: "Ментальная", emotional: "Эмоциональная", spiritual: "Духовная" };
        var dirNames = { drop: "просадка", rise: "рост", low: "низкая", high: "высокая", stable: "стабильно" };

        var todayKey = new Date().toISOString().split("T")[0];
        var yesterdayKey = new Date(Date.now() - 86400000).toISOString().split("T")[0];

        // Re-group on client (server groups but we want sorted entries within each day)
        var grouped = {};
        data.observations.forEach(function (o) {
          var dateKey = o.createdAt.split("T")[0];
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push(o);
        });

        // Sort entries within each day by time ascending (morning → evening)
        Object.keys(grouped).forEach(function (key) {
          grouped[key].sort(function (a, b) {
            return new Date(a.createdAt) - new Date(b.createdAt);
          });
        });

        var html = Object.entries(grouped)
          .sort(function (a, b) { return b[0].localeCompare(a[0]); })
          .map(function (entry) {
            var dateKey = entry[0];
            var obs = entry[1];
            var isToday = dateKey === todayKey;
            var isYesterday = dateKey === yesterdayKey;

            // Date label
            var dateLabel;
            if (isToday) {
              dateLabel = "Сегодня";
            } else if (isYesterday) {
              dateLabel = "Вчера";
            } else {
              dateLabel = new Date(dateKey + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
            }

            // Day summary: count drops/rises per energy type
            var daySummary = buildDaySummary(obs, emojiMap, dirNames);

            // Entries sorted by time
            var entries = obs.map(function (o) {
              var time = new Date(o.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
              var emoji = emojiMap[o.energyType] || "•";
              var typeName = typeNames[o.energyType] || o.energyType;
              var dirLabel = dirNames[o.direction] || o.direction;
              var contextText = o.context || "";
              var rec = o.recommendation ? '<div class="journal-rec">💡 ' + o.recommendation + '</div>' : '';
              var trigger = o.trigger ? '<div class="journal-trigger">' + o.trigger + '</div>' : '';

              return '<div class="journal-entry" data-type="' + o.energyType + '">' +
                '<div class="journal-entry-header">' +
                  '<span class="journal-type">' + emoji + ' ' + typeName + '</span>' +
                  '<span class="journal-dir-badge ' + o.direction + '">' + dirLabel + '</span>' +
                  '<span class="journal-time">' + time + '</span>' +
                '</div>' +
                (contextText ? '<div class="journal-context">' + contextText + '</div>' : '') +
                trigger + rec +
              '</div>';
            }).join("");

            return '<div class="journal-day' + (isToday ? ' journal-today' : '') + '">' +
              '<div class="journal-day-header">' +
                '<div class="journal-date' + (isToday ? ' journal-date-today' : '') + '">' + dateLabel + '</div>' +
                '<div class="journal-day-count">' + obs.length + ' ' + getNoteWord(obs.length) + '</div>' +
              '</div>' +
              (daySummary ? '<div class="journal-day-summary">' + daySummary + '</div>' : '') +
              '<div class="journal-entries">' + entries + '</div>' +
            '</div>';
          }).join("");

        list.innerHTML = html;
      });
  }

  function buildDaySummary(obs, emojiMap, dirNames) {
    var drops = obs.filter(function (o) { return o.direction === "drop" || o.direction === "low"; });
    var rises = obs.filter(function (o) { return o.direction === "rise" || o.direction === "high"; });

    var parts = [];

    if (drops.length > 0) {
      var dropTypes = drops.map(function (o) { return emojiMap[o.energyType] || ""; });
      var unique = dropTypes.filter(function (v, i, a) { return a.indexOf(v) === i; });
      parts.push("🔻 " + unique.join("") + " просадки: " + drops.length);
    }

    if (rises.length > 0) {
      var riseTypes = rises.map(function (o) { return emojiMap[o.energyType] || ""; });
      var unique = riseTypes.filter(function (v, i, a) { return a.indexOf(v) === i; });
      parts.push("🔺 " + unique.join("") + " рост: " + rises.length);
    }

    return parts.join("  ·  ");
  }

  function getNoteWord(n) {
    var abs = Math.abs(n) % 100;
    var last = abs % 10;
    if (abs > 10 && abs < 20) return "записей";
    if (last > 1 && last < 5) return "записи";
    if (last === 1) return "запись";
    return "записей";
  }
});
