# Архітектура Lead Generation Dashboard

## 🏗️ Загальна архітектура системи

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Лідгенератори │    │   Google Form   │    │  Google Sheets  │
│                 │───▶│                 │───▶│                 │
│ Заповнюють дані │    │ Збирає дані     │    │ LG Analytics    │
│ щоденно         │    │ з форми         │    │ Mastersheet     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Веб-дашборд    │    │    data.json    │    │ GitHub Actions  │
│                 │◀───│                 │◀───│                 │
│ index.html      │    │ Локальне        │    │ update_data.py  │
│ charts.js       │    │ сховище даних   │    │ Автоматичне     │
│                 │    │                 │    │ оновлення       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔄 Детальний потік даних

### 1. Введення даних (Data Input)

```
Лідгенератор → Google Form → Google Sheets
     │              │              │
     ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Щоденні  │  │ Валідація│  │ Аркуш:   │
│ показники│  │ даних    │  │ Form     │
│ роботи   │  │          │  │ responses│
│          │  │          │  │ 1        │
└──────────┘  └──────────┘  └──────────┘
```

**Дані що збираються:**
- Name (ім'я лідгенератора)
- Date (дата роботи)
- Country (країна)
- Created (створені ліди)
- Sent Requests (відправлені запити)
- Connected (підключення)
- Total replies (загальні відповіді)
- Positive Replies (позитивні відповіді)
- Events Created (створені події)
- Rate (тип зайнятості)
- Source (джерело лідів)

### 2. Автоматичне оновлення (Automated Update)

```
GitHub Actions → Python Script → Google Sheets API → data.json
     │              │              │                  │
     ▼              ▼              ▼                  ▼
┌──────────┐  ┌──────────┐  ┌──────────┐    ┌──────────┐
│ Cron:    │  │ update_  │  │ Service  │    │ Локальне │
│ 20:00    │  │ data.py  │  │ Account  │    │ JSON     │
│ UTC      │  │          │  │ Auth     │    │ файл     │
│ щодня    │  │          │  │          │    │          │
└──────────┘  └──────────┘  └──────────┘    └──────────┘
```

**Процес оновлення:**
1. GitHub Actions запускається за розкладом
2. Створюється Python середовище
3. Встановлюються залежності (gspread, google-auth)
4. Створюється service account файл з GitHub Secrets
5. Python скрипт підключається до Google Sheets API
6. Отримуються всі дані з аркуша "Form responses 1"
7. Дані зберігаються в data.json з timestamp
8. Оновлений файл комітиться в репозиторій

### 3. Відображення даних (Data Visualization)

```
data.json → index.html → Chart.js → Interactive Dashboard
     │          │           │              │
     ▼          ▼           ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ JSON     │ │ HTML     │ │ Chart    │ │ Веб-     │
│ дані     │ │ структура│ │ бібліотека│ │ дашборд  │
│          │ │          │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

## 📊 Структура веб-дашборду

### HTML Architecture

```
index.html
├── Head Section
│   ├── Meta tags
│   ├── Chart.js CDN
│   ├── CSS Styles
│   └── Module imports
├── Body Section
│   ├── Header (Title + Update timestamp)
│   ├── Controls Section
│   │   ├── Date Range Filters
│   │   └── Action Buttons
│   ├── Tabs Navigation
│   │   ├── Funnel Tab
│   │   ├── Countries Tab
│   │   ├── Weekly Tab
│   │   ├── Monthly Tab
│   │   └── Leaderboard Tab
│   ├── Tab Panels
│   │   ├── Funnel Panel
│   │   │   └── Dashboard Grid
│   │   │       ├── Created → Sent Requests Chart
│   │   │       ├── Sent Requests → Connected Chart
│   │   │       ├── Connected → Replies Chart
│   │   │       ├── Replies → Positive Replies Chart
│   │   │       └── Positive Replies → Events Chart
│   │   ├── Countries Panel (similar structure)
│   │   ├── Weekly Panel (similar structure)
│   │   ├── Monthly Panel (similar structure)
│   │   └── Leaderboard Panel
│   │       └── Dashboard Grid
│   │           ├── Created by Lead Generator Chart
│   │           ├── Sent Requests by Lead Generator Chart
│   │           ├── Positive Replies by Lead Generator Chart
│   │           └── Events Created by Lead Generator Chart
│   └── Modal Overlay
│       └── Day Summary Modal
└── Script Section
    ├── Data fetching
    ├── Chart rendering
    ├── Tab management
    └── Modal management
```

### JavaScript Module Structure

```
charts.js (ES6 Module)
├── renderPairedBarChart()
│   ├── Chart.js configuration
│   ├── Two dataset setup
│   └── Responsive options
└── renderSingleBarChart()
    ├── Chart.js configuration
    ├── Single dataset setup
    └── Responsive options

index.html (Main Script)
├── Data Management
│   ├── fetch_data()
│   ├── parseDdMmYyyyToDate()
│   └── toIsoDateInputValue()
├── Aggregation Functions
│   ├── buildAggregates()
│   ├── buildCountryAggregates()
│   ├── buildWeeklyAggregates()
│   ├── buildMonthlyAggregates()
│   └── buildLeaderboardAggregates()
├── Chart Management
│   ├── chartRefs object
│   ├── destroyIfExists()
│   └── renderAll()
├── UI Management
│   ├── Tab switching
│   ├── Date filtering
│   ├── Modal management
│   └── CSV export
└── Utility Functions
    ├── getIsoWeekInfo()
    ├── getRowsForDay()
    └── buildCsvForDay()
```

## 🔧 Технічні компоненти

### Google Sheets API Integration

```
Python Script (update_data.py)
├── Authentication
│   ├── Service Account JSON
│   ├── OAuth2 Scopes
│   └── Credentials setup
├── Data Fetching
│   ├── gspread client
│   ├── Spreadsheet connection
│   └── Worksheet access
└── Data Processing
    ├── get_all_records()
    ├── JSON serialization
    └── File writing
```

### GitHub Actions Workflow

```
.github/workflows/update.yml
├── Triggers
│   ├── Schedule (cron: "0 20 * * *")
│   └── Manual (workflow_dispatch)
├── Environment Setup
│   ├── Ubuntu Latest
│   ├── Python 3.11
│   └── Dependencies installation
├── Secret Management
│   └── GOOGLE_SERVICE_KEY
└── Git Operations
    ├── Checkout code
    ├── Run Python script
    ├── Commit changes
    └── Push updates
```

### Chart.js Integration

```
Chart.js Configuration
├── Chart Types
│   ├── Bar Charts (paired)
│   └── Bar Charts (single)
├── Data Sources
│   ├── Labels (dates/countries/names)
│   └── Datasets (metrics)
├── Styling
│   ├── Colors (soft themes)
│   ├── Responsive design
│   └── Animation settings
└── Interactions
    ├── Hover effects
    ├── Click events
    └── Resize handling
```

## 📱 Responsive Design

### Breakpoint Strategy

```
Desktop (1200px+)
├── Grid: 2 columns
├── Chart height: 380px
└── Full feature set

Tablet (900px - 1200px)
├── Grid: 2 columns (smaller)
├── Chart height: 380px
└── Adjusted spacing

Mobile (< 900px)
├── Grid: 1 column
├── Chart height: 300px
└── Stacked layout
```

### CSS Architecture

```
CSS Structure
├── Base Styles
│   ├── Typography
│   ├── Colors
│   └── Layout
├── Component Styles
│   ├── Charts
│   ├── Tabs
│   ├── Modals
│   └── Forms
├── Theme Styles
│   └── Soft color palettes
└── Responsive Styles
    ├── Media queries
    └── Grid adjustments
```

## 🔒 Security Architecture

### Authentication Flow

```
Service Account Authentication
├── Google Cloud Console
│   ├── Project creation
│   ├── API enablement
│   └── Service account creation
├── Credentials Management
│   ├── JSON key generation
│   ├── GitHub Secrets storage
│   └── Runtime credential loading
└── Access Control
    ├── Read-only permissions
    ├── Specific spreadsheet access
    └── API rate limiting
```

### Data Flow Security

```
Data Security Layers
├── Transport Security
│   └── HTTPS everywhere
├── Access Control
│   ├── Service account permissions
│   └── GitHub repository access
├── Data Validation
│   ├── Input sanitization
│   └── Type checking
└── Error Handling
    ├── Graceful degradation
    └── Secure error messages
```

## 📈 Performance Optimization

### Loading Strategy

```
Performance Optimizations
├── Chart.js
│   ├── Animation disabled
│   ├── Responsive enabled
│   └── Memory management
├── Data Processing
│   ├── Efficient filtering
│   ├── Cached results
│   └── Lazy loading
└── Network
    ├── CDN for libraries
    ├── Minified resources
    └── Cached data.json
```

### Memory Management

```
Memory Optimization
├── Chart Management
│   ├── destroyIfExists()
│   ├── Reference cleanup
│   └── Garbage collection
├── Data Management
│   ├── Filtered datasets
│   ├── Efficient aggregation
│   └── Reference management
└── DOM Management
    ├── Event listener cleanup
    ├── Modal state management
    └── Tab switching optimization
```

---

*Архітектурна документація оновлена: 2025-01-27*

