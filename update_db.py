import sqlite3

def update_db():
    conn = sqlite3.connect('db.sqlite')
    cursor = conn.cursor()
    
    # List tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print(f"Tables found: {tables}")
    
    # Determine table name (case-insensitive check)
    ipo_table = None
    for t in tables:
        if t[0].lower() == 'ipo':
            ipo_table = t[0]
            break
            
    if not ipo_table:
        print("IPO table not found!")
        conn.close()
        return

    print(f"Using table: {ipo_table}")

    # Check columns
    cursor.execute(f"PRAGMA table_info({ipo_table})")
    columns = [info[1] for info in cursor.fetchall()]
    
    print(f"Current columns: {columns}")
    
    if 'ipo_type' not in columns:
        print("Adding ipo_type column...")
        cursor.execute(f"ALTER TABLE {ipo_table} ADD COLUMN ipo_type VARCHAR(20) DEFAULT 'Mainboard'")
        
    if 'status' not in columns:
        print("Adding status column...")
        cursor.execute(f"ALTER TABLE {ipo_table} ADD COLUMN status VARCHAR(20) DEFAULT 'Open'")
        
    if 'listing_date' not in columns:
        print("Adding listing_date column...")
        cursor.execute(f"ALTER TABLE {ipo_table} ADD COLUMN listing_date DATE")
        
    conn.commit()
    conn.close()
    print("Database updated successfully.")

if __name__ == '__main__':
    update_db()
