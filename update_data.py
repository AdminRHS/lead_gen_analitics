import json
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime

# Дані таблиці
SPREADSHEET_ID = "1SNyKdbNIXHDdvqd71W57gkUe64Gsy2s9ylRCJJoJgJg"
SHEET_NAME = "Form responses 1"

# Авторизація через service account
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def get_credentials():
    """Отримати credentials з файлу або з GitHub Secrets."""
    import os
    
    # Спочатку спробуємо зчитати з файлу (для локального тестування)
    if os.path.exists("apiweb-474307-e5d97b1ea289.json"):
        return Credentials.from_service_account_file(
            "apiweb-474307-e5d97b1ea289.json", scopes=SCOPES
        )
    
    # Якщо файлу немає, читаємо з GitHub Secret (через змінну середовища)
    # Підтримуємо обидві назви: GOOGLE_SERVICE_KEY або GOOGLE_SHEETS_API_KEY
    service_key = os.environ.get('GOOGLE_SERVICE_KEY') or os.environ.get('GOOGLE_SHEETS_API_KEY')
    if service_key:
        import json
        service_key_json = json.loads(service_key)
        return Credentials.from_service_account_info(service_key_json, scopes=SCOPES)
    
    raise Exception("Не знайдено Service Account ключ ні в файлі, ні в змінних середовища")

CREDS = get_credentials()

def fetch_data():
    """Отримати всі дані з аркуша Google Sheets."""
    client = gspread.authorize(CREDS)
    sheet = client.open_by_key(SPREADSHEET_ID).worksheet(SHEET_NAME)
    data = sheet.get_all_records()  # повертає список словників
    print(f"✅ Успішно отримано {len(data)} рядків.")
    return data

def save_to_json(data):
    """Зберегти дані у файл data.json."""
    output = {
        "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "data": data
    }
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print("💾 Дані збережено у data.json")

if __name__ == "__main__":
    try:
        data = fetch_data()
        save_to_json(data)
    except Exception as e:
        print("❌ Помилка при зчитуванні:", e)
