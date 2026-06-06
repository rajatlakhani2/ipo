from app import app, db
from sqlalchemy import text

def migrate():
    with app.app_context():
        # Check if bank_name column exists
        try:
            with db.engine.connect() as conn:
                result = conn.execute(text("PRAGMA table_info(applications)"))
                columns = [row[1] for row in result]
                
                if 'bank_name' not in columns:
                    print("Adding bank_name column to applications table...")
                    conn.execute(text("ALTER TABLE applications ADD COLUMN bank_name VARCHAR(100)"))
                    conn.commit()
                    print("Migration successful!")
                else:
                    print("Column bank_name already exists.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == '__main__':
    migrate()
