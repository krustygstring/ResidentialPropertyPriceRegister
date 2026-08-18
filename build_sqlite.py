"""
Regenerates the app's database from the source CSV in one step:
PPR-ALL.csv -> (temporary) sqlite -> viewer/public/data/flat.sqlite.gzbin

Usage: python build_sqlite.py   (run from the repo root)
"""
import csv
import datetime
import gzip
import os
import shutil
import sqlite3
import tempfile

BASE = os.getcwd()
CSV_PATH = os.path.join(BASE, "PPR-ALL.csv")
OUTPUT_PATH = os.path.join(BASE, "viewer", "public", "data", "flat.sqlite.gzbin")


def to_iso_date(ddmmyyyy):
    parts = ddmmyyyy.split("/")
    if len(parts) != 3:
        return ""
    dd, mm, yyyy = parts
    return f"{yyyy}-{mm.zfill(2)}-{dd.zfill(2)}"


def to_price(raw):
    cleaned = "".join(c for c in raw if c.isdigit() or c == ".")
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def build_flat_db(db_path):
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE properties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_date TEXT, sale_date_sort TEXT, address TEXT, county TEXT, eircode TEXT,
            price REAL, not_full_market_price TEXT, vat_exclusive TEXT, description TEXT,
            property_size_description TEXT
        )
    """)
    conn.execute("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT)")
    conn.execute(
        "INSERT INTO metadata (key, value) VALUES ('import_date', ?)",
        (datetime.date.today().isoformat(),),
    )
    with open(CSV_PATH, "r", encoding="cp1252", newline="") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            sale_date = row["Date of Sale (dd/mm/yyyy)"]
            rows.append((
                sale_date, to_iso_date(sale_date), row["Address"], row["County"], row["Eircode"],
                to_price(row["Price (\u20ac)"]), row["Not Full Market Price"], row["VAT Exclusive"],
                row["Description of Property"], row["Property Size Description"],
            ))
    conn.executemany(
        "INSERT INTO properties (sale_date, sale_date_sort, address, county, eircode, price, "
        "not_full_market_price, vat_exclusive, description, property_size_description) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rows,
    )
    conn.execute("CREATE INDEX idx_county ON properties(county)")
    conn.execute("CREATE INDEX idx_price ON properties(price)")
    conn.execute("CREATE INDEX idx_date ON properties(sale_date_sort)")
    conn.commit()
    conn.execute("VACUUM")
    conn.close()
    print(f"Loaded {len(rows):,} rows from {os.path.basename(CSV_PATH)}")


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_db_path = os.path.join(tmp_dir, "flat.sqlite")
        build_flat_db(tmp_db_path)
        raw_size = os.path.getsize(tmp_db_path)

        with open(tmp_db_path, "rb") as f_in, gzip.open(OUTPUT_PATH, "wb", compresslevel=6) as f_out:
            shutil.copyfileobj(f_in, f_out)

    compressed_size = os.path.getsize(OUTPUT_PATH)
    print(f"Wrote {OUTPUT_PATH}")
    print(f"  raw sqlite: {raw_size / 1024 / 1024:.1f} MB")
    print(f"  compressed: {compressed_size / 1024 / 1024:.1f} MB ({compressed_size / raw_size:.0%} of raw)")


if __name__ == "__main__":
    main()
