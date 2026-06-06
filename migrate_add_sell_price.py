import sqlite3
import os

def migrate():
    # Try instance folder first as that's the default for Flask-SQLAlchemy
    db_path = os.path.join('instance', 'db_v2.sqlite')
    if not os.path.exists(db_path):
        db_path = 'db_v2.sqlite'
        
    print(f"Connecting to database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE application ADD COLUMN sell_price FLOAT")
        print("Successfully added sell_price column")
    except sqlite3.OperationalError as e:
        print(f"Column might already exist: {e}")
        
    conn.commit()
    conn.close()

if __name__ == '__main__':
    migrate()
