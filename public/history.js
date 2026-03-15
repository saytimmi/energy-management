/* global Chart */

(function () {
  var currentChart = null;
  var currentPeriod = "week";
  var currentTelegramId = null;

  window.initHistory = function (telegramId) {
    currentTelegramId = telegramId;
    currentPeriod = "week";

    // Reset period toggle
    var btns = document.querySelectorAll(".period-btn");
    btns.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-period") === "week");
    });

    fetchAndRender();
  };

  // Period toggle
  document.addEventListener("click", function (e) {
    if (!e.target.classList.contains("period-btn")) return;
    var period = e.target.getAttribute("data-period");
    if (period === currentPeriod) return;

    currentPeriod = period;
    var btns = document.querySelectorAll(".period-btn");
    btns.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-period") === period);
    });

    fetchAndRender();
  });

  function fetchAndRender() {
    if (!currentTelegramId) return;

    var emptyEl = document.getElementById("historyEmpty");
    var canvas = document.getElementById("historyChart");
    emptyEl.classList.add("hidden");
    canvas.style.display = "block";

    fetch("/api/history?telegramId=" + currentTelegramId + "&period=" + currentPeriod)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.length === 0) {
          showEmpty();
          return;
        }
        renderChart(data);
      })
      .catch(function () {
        showEmpty();
      });
  }

  function showEmpty() {
    var emptyEl = document.getElementById("historyEmpty");
    var canvas = document.getElementById("historyChart");
    emptyEl.classList.remove("hidden");
    canvas.style.display = "none";

    if (currentChart) {
      currentChart.destroy();
      currentChart = null;
    }
  }

  function renderChart(data) {
    // Destroy previous chart to avoid canvas reuse issues
    if (currentChart) {
      currentChart.destroy();
      currentChart = null;
    }

    var labels = data.map(function (d) {
      var parts = d.date.split("-");
      return parts[2] + "/" + parts[1]; // dd/mm
    });

    var canvas = document.getElementById("historyChart");
    var ctx = canvas.getContext("2d");

    currentChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Физическая",
            data: data.map(function (d) { return d.physical; }),
            borderColor: "#4CAF50",
            backgroundColor: "rgba(76, 175, 80, 0.1)",
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#4CAF50",
          },
          {
            label: "Ментальная",
            data: data.map(function (d) { return d.mental; }),
            borderColor: "#2196F3",
            backgroundColor: "rgba(33, 150, 243, 0.1)",
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#2196F3",
          },
          {
            label: "Эмоциональная",
            data: data.map(function (d) { return d.emotional; }),
            borderColor: "#FF9800",
            backgroundColor: "rgba(255, 152, 0, 0.1)",
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#FF9800",
          },
          {
            label: "Духовная",
            data: data.map(function (d) { return d.spiritual; }),
            borderColor: "#9C27B0",
            backgroundColor: "rgba(156, 39, 176, 0.1)",
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#9C27B0",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 10,
            ticks: {
              stepSize: 2,
              color: "#999",
            },
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
          },
          x: {
            ticks: {
              color: "#999",
              maxRotation: 45,
            },
            grid: {
              display: false,
            },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 10,
              font: { size: 12 },
            },
          },
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
      },
    });
  }
})();
