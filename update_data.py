import json
import os
from collections import defaultdict
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials

SPREADSHEET_ID = "1SNyKdbNIXHDdvqd71W57gkUe64Gsy2s9ylRCJJoJgJg"
SHEET_NAME = "Form responses 1"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


def get_credentials():
  """Отримати credentials з файлу або з GitHub Secrets."""
  if os.path.exists("apiweb-474307-e5d97b1ea289.json"):
    return Credentials.from_service_account_file(
      "apiweb-474307-e5d97b1ea289.json", scopes=SCOPES
    )

  service_key = os.environ.get("GOOGLE_SERVICE_KEY") or os.environ.get("GOOGLE_SHEETS_API_KEY")
  if service_key:
    service_key_json = json.loads(service_key)
    return Credentials.from_service_account_info(service_key_json, scopes=SCOPES)

  raise RuntimeError("Не знайдено Service Account ключ ні в файлі, ні в змінних середовища")


CREDS = get_credentials()


def fetch_data():
  """Отримати всі дані з аркуша Google Sheets."""
  client = gspread.authorize(CREDS)
  sheet = client.open_by_key(SPREADSHEET_ID).worksheet(SHEET_NAME)
  data = sheet.get_all_records()
  print(f"✅ Успішно отримано {len(data)} рядків.")
  return data


def save_to_json(data):
  payload = {
    "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
    "data": data,
  }
  with open("data.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
  print("💾 Дані збережено у data.json")


def safe_int(value):
  if isinstance(value, (int, float)):
    return int(value)
  if isinstance(value, str):
    stripped = value.strip()
    if not stripped:
      return 0
    try:
      return int(float(stripped.replace(",", ".")))
    except ValueError:
      return 0
  return 0


def parse_date(value):
  if not value:
    return None
  for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y"):
    try:
      return datetime.strptime(value, fmt)
    except ValueError:
      continue
  return None


def init_metric_bucket():
  return {
    "Created": 0,
    "SentRequests": 0,
    "Connected": 0,
    "Replies": 0,
    "PositiveReplies": 0,
    "Events": 0,
  }


def accumulate_metrics(bucket, row):
  bucket["Created"] += safe_int(row.get("Created"))
  bucket["SentRequests"] += safe_int(row.get("Sent Requests"))
  bucket["Connected"] += safe_int(row.get("Connected"))
  bucket["Replies"] += safe_int(row.get("Total replies"))
  bucket["PositiveReplies"] += safe_int(row.get("Positive Replies"))
  bucket["Events"] += safe_int(row.get("Events Created"))


def sort_week_keys(keys):
  return sorted(
    keys,
    key=lambda key: (
      int(key.split("-W")[0]),
      int(key.split("-W")[1]) if "-W" in key else 0,
    ),
  )


def build_summary(rows):
  totals = init_metric_bucket()
  weekly = defaultdict(init_metric_bucket)
  monthly = defaultdict(init_metric_bucket)
  countries = defaultdict(init_metric_bucket)

  min_date = None
  max_date = None

  for row in rows:
    date_obj = parse_date(row.get("Date"))
    if not date_obj:
      continue

    if not min_date or date_obj < min_date:
      min_date = date_obj
    if not max_date or date_obj > max_date:
      max_date = date_obj

    accumulate_metrics(totals, row)

    iso_year, iso_week, _ = date_obj.isocalendar()
    week_key = f"{iso_year}-W{iso_week:02d}"
    accumulate_metrics(weekly[week_key], row)

    month_key = date_obj.strftime("%Y-%m")
    accumulate_metrics(monthly[month_key], row)

    country_key = row.get("Country") or "Unknown"
    accumulate_metrics(countries[country_key], row)

  summary = {
    "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
    "min_date": min_date.isoformat() if min_date else None,
    "max_date": max_date.isoformat() if max_date else None,
    "totals": totals,
    "weekly": {key: weekly[key] for key in sort_week_keys(weekly.keys())},
    "monthly": {key: monthly[key] for key in sorted(monthly.keys())},
    "countries": {key: countries[key] for key in sorted(countries.keys())},
  }
  return summary


def save_summary(summary):
  with open("summary.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)
  print("📊 Серверні агрегати збережено у summary.json")


if __name__ == "__main__":
  try:
    data = fetch_data()
    save_to_json(data)
    summary = build_summary(data)
    save_summary(summary)
  except Exception as exc:
    print("❌ Помилка при зчитуванні:", exc)
