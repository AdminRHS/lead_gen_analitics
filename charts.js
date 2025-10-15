// Chart rendering helpers for Lead Generation Dashboard

export function renderPairedBarChart(
  canvasElement,
  labels,
  leftSeriesLabel,
  leftSeriesData,
  rightSeriesLabel,
  rightSeriesData
) {
  return new window.Chart(canvasElement, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: leftSeriesLabel,
          data: leftSeriesData,
          backgroundColor: "rgba(54,162,235,0.6)"
        },
        {
          label: rightSeriesLabel,
          data: rightSeriesData,
          backgroundColor: "rgba(75,192,192,0.6)"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: { y: { beginAtZero: true } }
    }
  });
}

export function renderSingleBarChart(
  canvasElement,
  labels,
  seriesLabel,
  seriesData,
  color = "rgba(54,162,235,0.6)"
) {
  return new window.Chart(canvasElement, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: seriesLabel,
          data: seriesData,
          backgroundColor: color
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: { y: { beginAtZero: true } }
    }
  });
}


