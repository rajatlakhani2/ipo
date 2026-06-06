from app import app, db, IPO
from datetime import date

def test_db():
    print("Testing database creation...")
    try:
        with app.app_context():
            print("Creating tables...")
            db.create_all()
            print("Tables created.")
            
            print("Adding test IPO...")
            ipo = IPO(
                ipo_name="Test IPO Manual",
                ipo_type="Mainboard",
                status="Open",
                ipo_date=date.today(),
                num_shares=100,
                purchase_price_per_share=100.0
            )
            db.session.add(ipo)
            db.session.commit()
            print("Test IPO added successfully.")
            
            # Verify
            ipos = IPO.query.all()
            print(f"IPOs in DB: {[i.ipo_name for i in ipos]}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_db()
