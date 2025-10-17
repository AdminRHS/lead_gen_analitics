# Технічні деталі Lead Generation Dashboard

## 🔧 Детальний аналіз компонентів

### Google Sheets API Integration

#### Конфігурація
```python
SPREADSHEET_ID = "1SNyKdbNIXHDdvqd71W57gkUe64Gsy2s9ylRCJJoJgJg"
SHEET_NAME = "Form responses 1"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
```

#### Процес авторизації
1. **Service Account**: Використовується для server-to-server авторизації
2. **Credentials**: Завантажуються з JSON файлу `apiweb-474307-e5d97b1ea289.json`
3. **Scopes**: Тільки read-only доступ до Google Sheets
4. **Client**: Авторизація через `gspread.authorize(CREDS)`

#### Методи роботи з даними
- `sheet.get_all_records()`: Отримує всі дані як список словників
- Автоматичне обробка заголовків (перший рядок як keys)
- Конвертація даних в JSON формат

### Веб-дашборд архітектура

#### HTML структура
```html
<!DOCTYPE html>
<html lang="uk">
<head>
  <!-- Meta tags, Chart.js CDN, CSS -->
</head>
<body>
  <!-- Controls, Tabs, Tab panels, Modal -->
</body>
</html>
```

#### CSS архітектура
- **Responsive Grid**: CSS Grid для адаптивного макету
- **Soft Themes**: Пастельні кольори для карток графіків
- **Modal System**: Fixed overlay з центруванням
- **Tab System**: CSS-only таби з ARIA підтримкою

#### JavaScript модульна система
```javascript
// ES6 Modules
import { renderPairedBarChart, renderSingleBarChart } from './charts.js';

// Chart references storage
let chartRefs = {
  createdFound: null,
  sentConnected: null,
  // ... інші графіки
};
```

### GitHub Actions Workflow

#### YAML конфігурація
```yaml
name: Update Dashboard Data
on:
  schedule:
    - cron: "0 20 * * *"  # щодня о 20:00 UTC
  workflow_dispatch:       # ручний запуск

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: 3.11
      # ... інші кроки
```

#### Процес виконання
1. **Environment**: Ubuntu Latest
2. **Python Setup**: Версія 3.11
3. **Dependencies**: `gspread`, `google-auth`
4. **Secrets**: `GOOGLE_SERVICE_KEY` з GitHub Secrets
5. **Git Operations**: Автоматичний коміт та пуш

### Chart.js інтеграція

#### Типи графіків
1. **Paired Bar Charts**: Два стовпці для порівняння
2. **Single Bar Charts**: Одиночні стовпці для лідерборду

#### Конфігурація Chart.js
```javascript
{
  type: "bar",
  data: {
    labels: dates,
    datasets: [
      {
        label: "Created",
        data: createdData,
        backgroundColor: "rgba(54,162,235,0.6)"
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: { y: { beginAtZero: true } }
  }
}
```

#### Responsive поведінка
- `maintainAspectRatio: false`: Повний контроль над розміром
- `responsive: true`: Автоматичне масштабування
- `animation: false`: Вимкнені анімації для продуктивності

### Система вкладок

#### Реалізація
```javascript
const tabs = [
  { btn: document.getElementById('tab-funnel-btn'), panel: document.getElementById('tab-funnel') },
  { btn: document.getElementById('tab-country-btn'), panel: document.getElementById('tab-country') },
  // ... інші таби
];
```

#### Логіка перемикання
1. **ARIA підтримка**: `aria-selected`, `aria-controls`
2. **CSS класи**: `.active` для активної вкладки/панелі
3. **Chart Resize**: Автоматичне змінення розміру графіків
4. **Data Re-render**: Перерендеринг при зміні табу

### Система фільтрації

#### Date Range Filter
```javascript
function applyCurrentFilter() {
  const from = new Date(document.getElementById('fromDate').value);
  const to = new Date(document.getElementById('toDate').value);
  
  const filtered = rows.filter(r => {
    const d = parseDdMmYyyyToDate(r.Date);
    return d && d >= from && d <= to;
  });
  
  renderAll(filtered);
}
```

#### Date Parsing
```javascript
function parseDdMmYyyyToDate(str) {
  // Очікує формат DD/MM/YYYY
  const [dd, mm, yyyy] = (str || '').split('/').map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}
```

### Агрегація даних

#### Функції агрегації
1. **buildAggregates()**: Агрегація по датах
2. **buildCountryAggregates()**: Агрегація по країнах
3. **buildWeeklyAggregates()**: Агрегація по тижнях (ISO)
4. **buildMonthlyAggregates()**: Агрегація по місяцях
5. **buildLeaderboardAggregates()**: Агрегація по лідгенераторах

#### ISO Week Calculation
```javascript
function getIsoWeekInfo(dateObj) {
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1..7, Monday=1
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
```

### Модальна система

#### Day Summary Modal
```javascript
const overlay = document.getElementById('dayModalOverlay');
function openModal() { overlay.style.display = 'flex'; }
function closeModal() { overlay.style.display = 'none'; }
```

#### CSV Export
```javascript
function buildCsvForDay(dayRows) {
  const headers = ["Name","Created","Sent Requests","Connected","Positive Replies","Events"];
  // ... обробка даних
  let csv = headers.join(',') + '\n';
  // ... формування CSV
  return csv;
}
```

### Безпека та конфігурація

#### GitHub Secrets
- `GOOGLE_SERVICE_KEY`: JSON вміст service account ключа
- Автоматичне створення файлу в workflow:
```bash
echo '${{ secrets.GOOGLE_SERVICE_KEY }}' > service_account.json
```

#### Service Account права
- **Scope**: `https://www.googleapis.com/auth/spreadsheets.readonly`
- **Access Level**: Read-only доступ до конкретної таблиці
- **Expiration**: Ключі не мають терміну дії

### Продуктивність та оптимізація

#### Chart.js оптимізації
- `animation: false`: Вимкнені анімації
- `responsive: true`: Автоматичне масштабування
- `maintainAspectRatio: false`: Контрольовані розміри

#### Memory Management
```javascript
function destroyIfExists(chartInstance) {
  if (chartInstance && typeof chartInstance.destroy === 'function') {
    chartInstance.destroy();
  }
}
```

#### Data Processing
- Фільтрація даних перед рендерингом
- Кешування `lastFilteredRows`
- Перерендеринг тільки при зміні даних

### Помилкообробка

#### Python скрипт
```python
try:
  data = fetch_data()
  save_to_json(data)
except Exception as e:
  print("❌ Помилка при зчитуванні:", e)
```

#### JavaScript
```javascript
// Валідація даних
const d = parseDdMmYyyyToDate(row.Date);
if (!d) continue; // Пропуск невалідних дат

// Fallback для відсутніх даних
const name = row.Name || 'Unknown';
const value = Number(row["Created"] || 0);
```

### Логування та моніторинг

#### Python логування
```python
print(f"✅ Успішно отримано {len(data)} рядків.")
print("💾 Дані збережено у data.json")
print("❌ Помилка при зчитуванні:", e)
```

#### Browser Console
- Chart.js автоматичні логи
- Custom debug інформація
- Network request моніторинг

### Розширюваність

#### Додавання нових графіків
1. Додати HTML canvas елемент
2. Створити chart reference в `chartRefs`
3. Додати рендеринг в `renderAll()`
4. Додати в `resizeChartsFor()`

#### Додавання нових агрегацій
1. Створити функцію агрегації
2. Додати виклик в `renderAll()`
3. Створити відповідні графіки

### Troubleshooting Guide

#### Часті проблеми

1. **Charts не відображаються**:
   - Перевірити консоль браузера
   - Переконатися, що data.json завантажується
   - Перевірити формат даних

2. **GitHub Actions fails**:
   - Перевірити валідність GOOGLE_SERVICE_KEY
   - Переконатися, що таблиця доступна
   - Перевірити cron синтаксис

3. **Date parsing errors**:
   - Перевірити формат дат в Google Sheets
   - Переконатися, що дати в форматі DD/MM/YYYY

4. **Performance issues**:
   - Оптимізувати розмір data.json
   - Додати пагінацію
   - Використовувати lazy loading

---

*Технічна документація оновлена: 2025-01-27*
