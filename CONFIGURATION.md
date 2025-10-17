# Конфігурація та налаштування Lead Generation Dashboard

## 🔧 Конфігураційні файли

### Google Sheets налаштування

#### Основні параметри
```python
# update_data.py
SPREADSHEET_ID = "1SNyKdbNIXHDdvqd71W57gkUe64Gsy2s9ylRCJJoJgJg"
SHEET_NAME = "Form responses 1"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
```

#### Структура даних в Google Sheets
| Поле | Тип | Опис | Приклад |
|------|-----|------|---------|
| Timestamp | DateTime | Час заповнення форми | "14/10/2025 13:07:34" |
| Score | String | Оцінка (поки не використовується) | "" |
| Name | String | Ім'я лідгенератора | "Davlatmamadova Firuza" |
| Date | Date | Дата роботи | "14/10/2025" |
| Rate | String | Тип зайнятості | "Full time" / "Part time" |
| Updated | Number | Номер оновлення | 4 |
| Country | String | Країна роботи | "Germany" |
| Created | Number | Створені ліди | 12 |
| Sent Requests | Number | Відправлені запити | 1 |
| Connected | Number | Підключення | 1 |
| Total replies | String | Загальні відповіді | "" |
| Positive Replies | Number | Позитивні відповіді | 2 |
| Emails sent | Number | Відправлені email | 3 |
| Events Created | Number | Створені події | 2 |
| Old Connections Messaged | Number | Повідомлення старим контактам | 2 |
| Notes | String | Нотатки | "" |
| Source | String | Джерело лідів | "Job sites" / "LinkedIn" |
| Calls took place | String | Дзвінки | "" / "0" |

### GitHub Actions конфігурація

#### .github/workflows/update.yml
```yaml
name: Update Dashboard Data

# Тригери запуску
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

      - name: Install dependencies
        run: pip install gspread google-auth

      - name: Create service account file from secret
        run: |
          echo '${{ secrets.GOOGLE_SERVICE_KEY }}' > service_account.json

      - name: Fetch data from Google Sheets
        run: python update_data.py

      - name: Commit and push data.json
        run: |
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add data.json
          git commit -m "update data.json" || echo "No changes"
          git push
```

#### Cron Schedule налаштування
- **Поточний**: `0 20 * * *` (щодня о 20:00 UTC)
- **Альтернативи**:
  - `0 */6 * * *` - кожні 6 годин
  - `0 9,15,21 * * *` - о 9:00, 15:00, 21:00 UTC
  - `0 20 * * 1-5` - щодня о 20:00, тільки робочі дні

### Веб-дашборд налаштування

#### CSS Theme конфігурація
```css
/* Soft themed cards (дуже світлі пастельні кольори) */
.chart-card.soft-blue { 
  background: linear-gradient(180deg, #f6f9ff, #ffffff); 
  border: 1px solid #e6edff; 
}
.chart-card.soft-purple { 
  background: linear-gradient(180deg, #faf6ff, #ffffff); 
  border: 1px solid #eee6ff; 
}
.chart-card.soft-green { 
  background: linear-gradient(180deg, #f6fffb, #ffffff); 
  border: 1px solid #e6fff3; 
}
.chart-card.soft-yellow { 
  background: linear-gradient(180deg, #fffdf6, #ffffff); 
  border: 1px solid #fff5d6; 
}
.chart-card.soft-pink { 
  background: linear-gradient(180deg, #fff6fb, #ffffff); 
  border: 1px solid #ffe6f3; 
}
```

#### Chart.js конфігурація
```javascript
// Кольори для графіків
const colors = {
  primary: "rgba(54,162,235,0.6)",    // Синій
  secondary: "rgba(75,192,192,0.6)",  // Зелений
  tertiary: "rgba(153,102,255,0.6)",  // Фіолетовий
  quaternary: "rgba(255,206,86,0.6)", // Жовтий
  quinary: "rgba(255,99,132,0.6)"     // Рожевий
};

// Налаштування графіків
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  scales: { 
    y: { beginAtZero: true } 
  }
};
```

#### Responsive breakpoints
```css
/* Dashboard grid responsive */
.dashboard-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(2, minmax(520px, 1fr));
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 1200px) {
  .dashboard-grid { 
    grid-template-columns: repeat(2, minmax(420px, 1fr)); 
  }
}

@media (max-width: 900px) {
  .dashboard-grid { 
    grid-template-columns: 1fr; 
  }
}
```

### Service Account налаштування

#### Створення Service Account
1. Перейти в [Google Cloud Console](https://console.cloud.google.com/)
2. Створити новий проект або вибрати існуючий
3. Увімкнути Google Sheets API
4. Створити Service Account:
   - IAM & Admin → Service Accounts
   - Create Service Account
   - Надати назву та опис
   - Створити ключ (JSON)

#### Права доступу
```json
{
  "type": "service_account",
  "project_id": "apiweb-474307",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "leadgen-dashboard@apiweb-474307.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

#### Налаштування доступу до таблиці
1. Відкрити Google Sheets таблицю
2. Натиснути "Share" (Поділитися)
3. Додати email Service Account: `leadgen-dashboard@apiweb-474307.iam.gserviceaccount.com`
4. Встановити права: "Viewer" (тільки читання)

### GitHub Secrets налаштування

#### Додавання секрету
1. Перейти в репозиторій на GitHub
2. Settings → Secrets and variables → Actions
3. New repository secret
4. Name: `GOOGLE_SERVICE_KEY`
5. Value: повний JSON вміст service account файлу

#### Формат секрету
```json
{
  "type": "service_account",
  "project_id": "apiweb-474307",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@apiweb-474307.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40apiweb-474307.iam.gserviceaccount.com"
}
```

### Локальне налаштування

#### requirements.txt
```
gspread==5.12.0
google-auth==2.23.4
google-auth-oauthlib==1.1.0
google-auth-httplib2==0.1.1
```

#### .env файл (опціонально)
```bash
# Google Sheets
SPREADSHEET_ID=1SNyKdbNIXHDdvqd71W57gkUe64Gsy2s9ylRCJJoJgJg
SHEET_NAME=Form responses 1

# GitHub
GITHUB_TOKEN=your-github-token
REPOSITORY=your-org/leadgen-dashboard
```

#### .gitignore
```
# Service account keys
*.json
!package*.json

# Python
__pycache__/
*.py[cod]
*$py.class
.env

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

### Моніторинг та алерти

#### GitHub Actions моніторинг
- **Success Rate**: Моніторинг успішних запусків
- **Duration**: Час виконання workflow
- **Errors**: Логи помилок

#### Google Sheets API ліміти
- **Quota**: 100 requests per 100 seconds per user
- **Daily Limit**: 1,000,000 requests per day
- **Monitoring**: Google Cloud Console → APIs & Services → Quotas

#### Веб-дашборд моніторинг
```javascript
// Додати в index.html для моніторингу
console.log('Dashboard loaded at:', new Date().toISOString());
console.log('Data last updated:', document.getElementById('update').textContent);
console.log('Total records:', lastFilteredRows?.length || 0);
```

### Резервне копіювання

#### Автоматичне резервне копіювання
```yaml
# Додати в .github/workflows/update.yml
- name: Backup data.json
  run: |
    cp data.json "backup/data-$(date +%Y%m%d-%H%M%S).json"
    # Зберігати тільки останні 30 днів
    find backup/ -name "data-*.json" -mtime +30 -delete
```

#### Ручне резервне копіювання
```bash
# Створити резервну копію
cp data.json "backup/data-$(date +%Y%m%d).json"

# Відновити з резервної копії
cp "backup/data-20250127.json" data.json
```

### Налаштування для різних середовищ

#### Development
```python
# update_data.py - development режим
DEBUG = True
DRY_RUN = False  # True для тестування без зміни файлів
LOG_LEVEL = "DEBUG"
```

#### Production
```python
# update_data.py - production режим
DEBUG = False
DRY_RUN = False
LOG_LEVEL = "INFO"
```

#### Staging
```python
# update_data.py - staging режим
DEBUG = True
DRY_RUN = True  # Тестування без зміни файлів
LOG_LEVEL = "DEBUG"
```

### Налаштування безпеки

#### HTTPS налаштування
```javascript
// Примусове використання HTTPS
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.replace('https:' + window.location.href.substring(window.location.protocol.length));
}
```

#### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data:;">
```

#### API Rate Limiting
```python
# Додати в update_data.py
import time

def rate_limit_request():
    """Затримка між запитами для уникнення rate limiting"""
    time.sleep(0.1)  # 100ms затримка
```

---

*Конфігураційна документація оновлена: 2025-01-27*
