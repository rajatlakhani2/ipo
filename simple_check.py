import sqlite3

conn = sqlite3.connect('db_v2.sqlite')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()

print("Tables:")
for table in tables:
    print(f"  {table[0]}")

conn.close()