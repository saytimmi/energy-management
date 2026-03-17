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

  // Date & greeting
  var now = new Date();
  var dateEl = document.getElementById("currentDate");
  dateEl.textContent = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });

  var hour = now.getHours();
  var greetingEl = document.getElementById("greetingText");
  if (hour < 6)       greetingEl.textContent = "Доброй ночи,";
  else if (hour < 12) greetingEl.textContent = "Доброе утро,";
  else if (hour < 18) greetingEl.textContent = "Добрый день,";
  else                greetingEl.textContent = "Добрый вечер,";

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

    if (!dashboard.error) {
      renderRings(dashboard);
      if (dashboard.streak && dashboard.streak > 0) {
        var streakEl = document.getElementById("streakBadge");
        streakEl.textContent = "\uD83D\uDD25 " + dashboard.streak + " " + getDayWord(dashboard.streak) + " подряд";
        streakEl.classList.remove("hidden");
      }
    } else {
      document.querySelector(".energy-rings").insertAdjacentHTML("afterend",
        '<div class="dashboard-empty-msg">Расскажи боту как ты себя чувствуешь — я начну отслеживать 🌱</div>');
    }

    renderObservations(obsData);

    if (obsData.stats && obsData.stats.total >= 3) {
      loadAnalytics();
    }

    document.getElementById("quickCheckinBtn").addEventListener("click", function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = "Отправляю...";
      fetch("/api/checkin-trigger?telegramId=" + telegramId)
        .then(function () {
          btn.textContent = "✓ Бот напишет тебе";
          setTimeout(function () { btn.disabled = false; btn.textContent = "⚡ Записать энергию"; }, 3000);
        })
        .catch(function () { btn.disabled = false; btn.textContent = "⚡ Записать энергию"; });
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

  // ── Helpers ──────────────────────────────────────

  function getDayWord(n) {
    var abs = Math.abs(n) % 100, last = abs % 10;
    if (abs > 10 && abs < 20) return "дней";
    if (last > 1 && last < 5) return "дня";
    if (last === 1) return "день";
    return "дней";
  }

  function getNoteWord(n) {
    var abs = Math.abs(n) % 100, last = abs % 10;
    if (abs > 10 && abs < 20) return "записей";
    if (last > 1 && last < 5) return "записи";
    if (last === 1) return "запись";
    return "записей";
  }

  function getTimeAgo(date) {
    var diff = new Date() - date;
    var mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
    if (mins < 1) return "только что";
    if (mins < 60) return mins + " мин назад";
    if (hours < 24) return hours + " ч назад";
    if (days === 1) return "вчера";
    if (days < 7) return days + " дн назад";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  // ── Rings ────────────────────────────────────────

  function renderRings(data) {
    var types = ["physical", "mental", "emotional", "spiritual"];
    types.forEach(function (type, i) {
      var card = document.querySelector('.ring-card[data-type="' + type + '"]');
      var val = data[type] || 0;
      var fill = card.querySelector(".ring-fill");
      var valEl = card.querySelector(".ring-val");
      valEl.textContent = val;
      var offset = 264 - (val / 10) * 264;
      setTimeout(function () { fill.style.strokeDashoffset = offset; }, i * 120);
    });
    if (data.loggedAt) {
      var d = new Date(data.loggedAt);
      document.getElementById("lastUpdate").textContent =
        "Обновлено " + d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    }
  }

  // ── Observations (dashboard) ─────────────────────

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
    var todayKey = new Date().toISOString().split("T")[0];

    var todayObs = data.observations.filter(function (o) { return o.createdAt.split("T")[0] === todayKey; });
    var notable = data.observations
      .filter(function (o) { return o.direction === "drop" || o.direction === "rise" || o.direction === "low"; })
      .slice(0, 5);

    var html = "";

    if (todayObs.length > 0) {
      html += '<div class="obs-today-card"><div class="obs-today-title">Сегодня</div><div class="obs-today-items">';
      todayObs.forEach(function (o) {
        html += '<div class="obs-today-item"><span>' + (emojiMap[o.energyType] || "•") + " " + (dirIcons[o.direction] || "") + '</span>' +
          '<span class="obs-today-text">' + (o.trigger || o.context || "") + '</span></div>';
      });
      html += '</div></div>';
    }

    notable.forEach(function (o, i) {
      var text = o.context || o.trigger || "";
      var tag = '<span class="obs-tag ' + o.direction + '">' + (dirNames[o.direction] || o.direction) + '</span>';
      html += '<div class="obs-item" style="animation-delay:' + (i * 0.06) + 's">' +
        '<span class="obs-emoji">' + (emojiMap[o.energyType] || "•") + '</span>' +
        '<div class="obs-body"><div class="obs-text">' + text + '</div>' +
        '<div class="obs-meta">' + tag + '<span>' + getTimeAgo(new Date(o.createdAt)) + '</span></div>' +
        '</div></div>';
    });

    if (html === "") { section.classList.add("hidden"); return; }
    list.innerHTML = html;
  }

  // ── Analytics ────────────────────────────────────

  function loadAnalytics() {
    fetch("/api/analytics?telegramId=" + telegramId)
      .then(r => r.json())
      .then(function (data) {
        if (!data || !data.insights) return;
        var section = document.getElementById("analyticsSection");
        var content = document.getElementById("analyticsContent");
        var text = Array.isArray(data.insights) ? data.insights.join("\n") : data.insights;
        var items = text.split(/\n(?=\d+\.)/).filter(function (s) { return s.trim(); });
        if (items.length <= 1) {
          content.innerHTML = '<div class="analytics-card">' + formatInsight(text) + '</div>';
        } else {
          content.innerHTML = items.map(function (item) {
            return '<div class="analytics-card">' + formatInsight(item.trim()) + '</div>';
          }).join("");
        }
        section.classList.remove("hidden");
      })
      .catch(function () {});
  }

  function formatInsight(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }

  // ── Chart (Timeline) — gradient fills ────────────

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

        var labels = data.map(function (d) {
          return new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
        });

        var ctx = canvas.getContext("2d");
        var h = canvas.offsetHeight || 240;

        function grad(r, g, b) {
          var g2 = ctx.createLinearGradient(0, 0, 0, h);
          g2.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",0.28)");
          g2.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
          return g2;
        }

        var datasets = [
          {
            label: "Физ", data: data.map(d => d.physical),
            borderColor: "#5be07a", backgroundColor: grad(91,224,122),
            tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5,
            fill: true
          },
          {
            label: "Мент", data: data.map(d => d.mental),
            borderColor: "#5ba8ff", backgroundColor: grad(91,168,255),
            tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5,
            fill: true
          },
          {
            label: "Эмоц", data: data.map(d => d.emotional),
            borderColor: "#ff8c5b", backgroundColor: grad(255,140,91),
            tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5,
            fill: true
          },
          {
            label: "Дух", data: data.map(d => d.spiritual),
            borderColor: "#c77dff", backgroundColor: grad(199,125,255),
            tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5,
            fill: true
          },
        ];

        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(canvas, {
          type: "line",
          data: { labels: labels, datasets: datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                min: 0, max: 10,
                ticks: { color: "#8a8690", stepSize: 2, font: { family: "Outfit", size: 11 } },
                grid: { color: "rgba(255,255,255,0.04)" },
                border: { display: false }
              },
              x: {
                ticks: { color: "#8a8690", maxRotation: 0, font: { family: "Outfit", size: 10 } },
                grid: { display: false },
                border: { display: false }
              },
            },
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  color: "#8a8690",
                  padding: 16,
                  font: { family: "Outfit", size: 11 },
                  boxWidth: 12, boxHeight: 2, useBorderRadius: true, borderRadius: 2
                }
              },
              tooltip: {
                backgroundColor: "#1a1a1f",
                borderColor: "rgba(255,255,255,0.08)",
                borderWidth: 1,
                titleColor: "#f0ede8",
                bodyColor: "#8a8690",
                titleFont: { family: "Outfit", size: 12, weight: "600" },
                bodyFont: { family: "Outfit", size: 11 },
                padding: 10,
                cornerRadius: 10,
                displayColors: true,
                boxWidth: 8, boxHeight: 8
              }
            },
            interaction: { intersect: false, mode: "index" },
          },
        });
      });
  }

  // ── Journal — Structured timeline style ──────────

  function loadJournal() {
    var list = document.getElementById("journalList");

    fetch("/api/observations?telegramId=" + telegramId)
      .then(r => r.json())
      .then(function (data) {
        if (!data.observations || data.observations.length === 0) {
          list.innerHTML =
            '<div class="journal-empty-state">' +
            '<div class="journal-empty-icon">📝</div>' +
            '<p>Твой дневник энергии пока пуст. Каждый разговор с ботом добавит запись сюда</p>' +
            '</div>';
          return;
        }

        var emojiMap  = { physical: "🏃", mental: "🧠", emotional: "💚", spiritual: "🔮" };
        var typeNames = { physical: "Физическая", mental: "Ментальная", emotional: "Эмоциональная", spiritual: "Духовная" };
        var dirNames  = { drop: "просадка", rise: "рост", low: "низкая", high: "высокая", stable: "стабильно" };

        var todayKey     = new Date().toISOString().split("T")[0];
        var yesterdayKey = new Date(Date.now() - 86400000).toISOString().split("T")[0];

        // Group by day
        var grouped = {};
        data.observations.forEach(function (o) {
          var key = o.createdAt.split("T")[0];
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(o);
        });

        // Sort entries within each day ascending
        Object.keys(grouped).forEach(function (k) {
          grouped[k].sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
        });

        var html = '<div class="journal-timeline">';

        Object.entries(grouped)
          .sort(function (a, b) { return b[0].localeCompare(a[0]); })
          .forEach(function (entry) {
            var dateKey = entry[0];
            var obs = entry[1];
            var isToday = dateKey === todayKey;
            var isYesterday = dateKey === yesterdayKey;

            var dateLabel;
            if (isToday) dateLabel = "Сегодня";
            else if (isYesterday) dateLabel = "Вчера";
            else dateLabel = new Date(dateKey + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });

            html += '<div class="tl-day">';
            html += '<div class="tl-day-header">' +
              '<span class="tl-day-label' + (isToday ? ' today' : '') + '">' + dateLabel + '</span>' +
              '<span class="tl-day-meta">' + obs.length + ' ' + getNoteWord(obs.length) + '</span>' +
              '</div>';

            html += '<div class="tl-entries">';

            obs.forEach(function (o, i) {
              var time = new Date(o.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
              var type = o.energyType;
              var dir  = o.direction;
              var emoji = emojiMap[type] || "•";
              var typeName = typeNames[type] || type;
              var dirLabel = dirNames[dir] || dir;
              var context = o.context || "";
              var trigger = o.trigger || "";
              var rec = o.recommendation || "";

              html += '<div class="tl-entry">' +
                '<div class="tl-time">' + time + '</div>' +
                '<div class="tl-line"><div class="tl-dot" data-type="' + type + '"></div></div>' +
                '<div class="tl-card" data-type="' + type + '">' +
                  '<div class="tl-card-top">' +
                    '<span class="tl-type-name">' + emoji + ' ' + typeName + '</span>' +
                    '<span class="tl-dir ' + dir + '">' + dirLabel + '</span>' +
                  '</div>' +
                  (context ? '<div class="tl-context">' + context + '</div>' : '') +
                  (trigger && trigger !== context ? '<div class="tl-trigger">' + trigger + '</div>' : '') +
                  (rec ? '<div class="tl-rec">💡 ' + rec + '</div>' : '') +
                '</div>' +
              '</div>';
            });

            html += '</div>'; // tl-entries
            html += '</div>'; // tl-day
          });

        html += '</div>'; // journal-timeline
        list.innerHTML = html;
      })
      .catch(function () {
        list.innerHTML = '<div class="journal-empty-state"><div class="journal-empty-icon">😔</div><p>Не удалось загрузить дневник</p></div>';
      });
  }

});
