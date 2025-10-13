import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export function renderBarChart(
  canvas: HTMLCanvasElement,
  labels: string[],
  values: number[],
  title = "Statistik"
) {
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: title, data: values, backgroundColor: "#0b5cff" }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}
