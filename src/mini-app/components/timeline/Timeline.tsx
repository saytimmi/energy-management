import { useEffect, useRef } from "preact/hooks";
import { signal } from "@preact/signals";
import Chart from "chart.js/auto";
import { api } from "../../api/client";
import type { HistoryPoint } from "../../api/types";

const period = signal<"week" | "month">("week");
const data = signal<HistoryPoint[]>([]);
const isEmpty = signal(false);

export function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => { loadData(period.value); }, []);

  useEffect(() => {
    if (!canvasRef.current || data.value.length === 0) return;
    renderChart(canvasRef.current, data.value, chartRef);
    return () => { chartRef.current?.destroy(); };
  }, [data.value]);

  async function loadData(p: "week" | "month") {
    period.value = p;
    try {
      const result = await api.history(p);
      data.value = result;
      isEmpty.value = result.length === 0;
    } catch { isEmpty.value = true; }
  }

  return (
    <section class="view">
      <div class="timeline-header">
        <div class="period-pills">
          <button class={`pill ${period.value === "week" ? "active" : ""}`} onClick={() => loadData("week")}>7 дней</button>
          <button class={`pill ${period.value === "month" ? "active" : ""}`} onClick={() => loadData("month")}>30 дней</button>
        </div>
      </div>
      <div class="chart-wrap"><canvas ref={canvasRef} /></div>
      {isEmpty.value && <p class="empty-msg">Пока нет данных</p>}
    </section>
  );
}

function renderChart(canvas: HTMLCanvasElement, points: HistoryPoint[], chartRef: { current: Chart | null }) {
  chartRef.current?.destroy();
  const ctx = canvas.getContext("2d")!;
  const h = canvas.offsetHeight || 240;
  function grad(r: number, g: number, b: number) {
    const g2 = ctx.createLinearGradient(0, 0, 0, h);
    g2.addColorStop(0, `rgba(${r},${g},${b},0.28)`);
    g2.addColorStop(1, `rgba(${r},${g},${b},0)`);
    return g2;
  }
  const labels = points.map((d) => new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }));
  const opts = { tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, fill: true };
  chartRef.current = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Физ", data: points.map((d) => d.physical), borderColor: "#5be07a", backgroundColor: grad(91, 224, 122), ...opts },
        { label: "Мент", data: points.map((d) => d.mental), borderColor: "#5ba8ff", backgroundColor: grad(91, 168, 255), ...opts },
        { label: "Эмоц", data: points.map((d) => d.emotional), borderColor: "#ff8c5b", backgroundColor: grad(255, 140, 91), ...opts },
        { label: "Дух", data: points.map((d) => d.spiritual), borderColor: "#c77dff", backgroundColor: grad(199, 125, 255), ...opts },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 10, ticks: { color: "#8a8690", stepSize: 2, font: { family: "Outfit", size: 11 } }, grid: { color: "rgba(255,255,255,0.04)" }, border: { display: false } },
        x: { ticks: { color: "#8a8690", maxRotation: 0, font: { family: "Outfit", size: 10 } }, grid: { display: false }, border: { display: false } },
      },
      plugins: {
        legend: { position: "bottom", labels: { color: "#8a8690", padding: 16, font: { family: "Outfit", size: 11 }, boxWidth: 12, boxHeight: 2, useBorderRadius: true, borderRadius: 2 } },
        tooltip: { backgroundColor: "#1a1a1f", borderColor: "rgba(255,255,255,0.08)", borderWidth: 1, titleColor: "#f0ede8", bodyColor: "#8a8690", titleFont: { family: "Outfit", size: 12, weight: "bold" }, bodyFont: { family: "Outfit", size: 11 }, padding: 10, cornerRadius: 10, displayColors: true, boxWidth: 8, boxHeight: 8 },
      },
      interaction: { intersect: false, mode: "index" },
    },
  });
}
