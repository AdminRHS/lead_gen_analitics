import json
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime

# Дані таблиці
SPREADSHEET_ID = "1SNyKdbNIXHDdvqd71W57gkUe64Gsy2s9ylRCJJoJgJg"
SHEET_NAME = "Form responses 1"

# Авторизація через service account
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
CREDS = Credentials.from_service_account_file(
    "apiweb-474307-e5d97b1ea289.json", scopes=SCOPES
)

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
