// Chart rendering helpers for Lead Generation Dashboard

export function renderPairedBarChart(
  canvasElement,
  labels,
  leftSeriesLabel,
  leftSeriesData,
  rightSeriesLabel,
  rightSeriesData
) {
  const chart = new window.Chart(canvasElement, {
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
  
  // Add onClick handler after chart creation
  if (chart) {
    chart.options.onClick = (evt) => {
      const points = chart.getElementsAtEventForMode(evt, 'index', { intersect: false }, false);
      if (points && points.length > 0) {
        // Get the index from the first point
        const index = points[0].index;
        const label = labels[index];
        
        // Get both values for the paired chart
        const leftValue = chart.data.datasets[0].data[index];
        const rightValue = chart.data.datasets[1].data[index];
        const leftLabel = chart.data.datasets[0].label;
        const rightLabel = chart.data.datasets[1].label;
        
        // Show modal with tooltip information
        if (window.showChartTooltipModal) {
          window.showChartTooltipModal({
            label: label,
            title: `${leftLabel} → ${rightLabel}`,
            data: [
              { label: leftLabel, value: leftValue },
              { label: rightLabel, value: rightValue }
            ]
          });
        }
      }
    };
  }
  
  return chart;
}

export function renderSingleBarChart(
  canvasElement,
  labels,
  seriesLabel,
  seriesData,
  color = "rgba(54,162,235,0.6)"
) {
  const chart = new window.Chart(canvasElement, {
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
  
  // Add onClick handler after chart creation
  if (chart) {
    chart.options.onClick = (evt) => {
      const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
      if (points && points.length > 0) {
        const element = points[0];
        const index = element.index;
        const label = labels[index];
        const value = chart.data.datasets[0].data[index];
        
        // Show modal with tooltip information
        if (window.showChartTooltipModal) {
          window.showChartTooltipModal({
            label: label,
            title: seriesLabel,
            data: [
              { label: seriesLabel, value: value }
            ]
          });
        }
      }
    };
  }
  
  return chart;
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
  
  const chart = new window.Chart(canvasElement, {
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
  
  // Add onClick handler after chart creation
  if (chart) {
    chart.options.onClick = (evt) => {
      const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
      if (points && points.length > 0) {
        const element = points[0];
        const index = element.index;
        const label = labels[index];
        const value = chart.data.datasets[0].data[index];
        
        // Show modal with tooltip information
        if (window.showChartTooltipModal) {
          window.showChartTooltipModal({
            label: label,
            title: seriesLabel,
            data: [
              { label: seriesLabel, value: value.toFixed(2) + '%' }
            ]
          });
        }
      }
    };
  }
  
  return chart;
}


