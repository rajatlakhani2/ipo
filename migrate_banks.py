"""
Migration script to add banks column to investors table
"""
import sqlite3

def migrate():
    # Connect to the database
    conn = sqlite3.connect('instance/db_v2.sqlite')
    cursor = conn.cursor()
    
    try:
        # Check if banks column exists
        cursor.execute("PRAGMA table_info(investor)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'banks' not in columns:
            print("Adding banks column to investor table...")
            cursor.execute("ALTER TABLE investor ADD COLUMN banks TEXT")
            conn.commit()
            print("Successfully added banks column!")
        else:
            print("Banks column already exists.")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
