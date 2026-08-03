(function () {
  const dataEl = document.getElementById('chart-data');
  if (!dataEl || typeof Chart === 'undefined') return;

  const data = JSON.parse(dataEl.textContent);

  const trendCtx = document.getElementById('trendChart');
  if (trendCtx) {
    new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: data.trend.map((t) => t.label),
        datasets: [
          { label: 'Income', data: data.trend.map((t) => t.income), borderColor: '#198754', tension: 0.3 },
          { label: 'Expense', data: data.trend.map((t) => t.expense), borderColor: '#dc3545', tension: 0.3 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  const categoryCtx = document.getElementById('categoryChart');
  if (categoryCtx) {
    new Chart(categoryCtx, {
      type: 'pie',
      data: {
        labels: data.byCategory.map((c) => c.category),
        datasets: [
          {
            data: data.byCategory.map((c) => c.amount),
            backgroundColor: ['#0d6efd', '#6610f2', '#d63384', '#fd7e14', '#198754', '#20c997', '#6c757d'],
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  const centerCtx = document.getElementById('centerChart');
  if (centerCtx) {
    new Chart(centerCtx, {
      type: 'bar',
      data: {
        labels: data.byCenter.map((c) => c.center),
        datasets: [
          { label: 'Income', data: data.byCenter.map((c) => c.income), backgroundColor: '#198754' },
          { label: 'Expense', data: data.byCenter.map((c) => c.expense), backgroundColor: '#dc3545' },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }
})();
