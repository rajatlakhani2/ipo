from app import app, db
from sqlalchemy import text

def check_tables():
    with app.app_context():
        with db.engine.connect() as conn:
            # List tables
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
            tables = [row[0] for row in result]
            print("Tables:", tables)
            
            for table in tables:
                print(f"\nSchema for {table}:")
                cols = conn.execute(text(f"PRAGMA table_info({table})"))
                for col in cols:
                    print(col)

if __name__ == '__main__':
    check_tables()
