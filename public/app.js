document.addEventListener("DOMContentLoaded", function () {
  // Initialize Telegram WebApp
  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  var loadingEl = document.getElementById("loading");
  var errorEl = document.getElementById("error");
  var dashboardEl = document.getElementById("dashboard");
  var historyEl = document.getElementById("history");
  var analyticsEl = document.getElementById("analytics");
  var loggedAtEl = document.getElementById("loggedAt");

  var views = { dashboard: dashboardEl, history: historyEl, analytics: analyticsEl };

  // Tab navigation
  var tabs = document.querySelectorAll(".tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var target = tab.getAttribute("data-tab");
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");

      Object.keys(views).forEach(function (key) {
        if (views[key]) {
          views[key].classList.toggle("hidden", key !== target);
        }
      });

      // Initialize history chart when switching to history tab
      if (target === "history" && telegramId && window.initHistory) {
        window.initHistory(telegramId);
      }
    });
  });

  // Get telegram user ID
  var telegramId = null;
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    telegramId = tg.initDataUnsafe.user.id;
  }

  if (!telegramId) {
    showError("Откройте приложение через Telegram бота");
    return;
  }

  // Fetch dashboard data
  fetch("/api/dashboard?telegramId=" + telegramId)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      loadingEl.classList.add("hidden");

      if (data.error === "no_data" || data.error === "user_not_found") {
        showError("Пока нет данных. Используй /energy в боте чтобы записать первый check-in");
        return;
      }

      if (data.error) {
        showError("Произошла ошибка загрузки данных");
        return;
      }

      renderDashboard(data);
    })
    .catch(function () {
      showError("Не удалось подключиться к серверу");
    });

  function showError(message) {
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorEl.querySelector(".error-text").textContent = message;
  }

  function renderDashboard(data) {
    dashboardEl.classList.remove("hidden");

    var types = ["physical", "mental", "emotional", "spiritual"];
    types.forEach(function (type, index) {
      var card = document.querySelector('.energy-card[data-type="' + type + '"]');
      if (!card) return;

      var value = data[type] || 0;
      var gaugeValue = card.querySelector(".gauge-value");
      var gaugeFill = card.querySelector(".gauge-fill");

      // Set value
      gaugeValue.textContent = value;

      // Calculate stroke offset (314 is circumference of r=50 circle)
      var circumference = 314;
      var offset = circumference - (value / 10) * circumference;
      setTimeout(function () {
        gaugeFill.style.strokeDashoffset = offset;
        card.classList.add("visible");
      }, index * 100);

      // Color coding based on level
      card.classList.remove("level-low", "level-mid");
      if (value <= 3) {
        card.classList.add("level-low");
      } else if (value <= 6) {
        card.classList.add("level-mid");
      }
    });

    // Show logged at time
    if (data.loggedAt) {
      var date = new Date(data.loggedAt);
      loggedAtEl.textContent = "Последний check-in: " + date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  }
});
