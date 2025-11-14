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
      interaction: {
        intersect: false,
        mode: 'index'
      },
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
      interaction: {
        intersect: false,
        mode: 'index'
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}

export function renderConversionRateChart(
  canvasElement,
  labels,
  seriesLabel,
  seriesData,
  color = "rgba(75,192,192,0.6)"
) {
  // Знаходимо максимальне значення в даних
  const maxValue = Math.max(...seriesData);
  // Встановлюємо максимум як 110% від найбільшого значення, але не менше 5%
  const yMax = Math.max(maxValue * 1.1, 5);
  
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
      scales: { 
        y: { 
          beginAtZero: true,
          max: yMax,
          ticks: {
            callback: function(value) {
              return value.toFixed(1) + '%';
            }
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + '%';
            }
          }
        },
        legend: {
          display: false
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });
}


