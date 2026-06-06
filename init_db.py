from app import app, db
from models import Investor, IPO, Application
from datetime import date

def init_database():
    """Initialize the database and create all tables"""
    with app.app_context():
        # Drop all tables and recreate (for development)
        db.drop_all()
        db.create_all()
        
        print("Database tables created successfully!")
        
        # Add sample data
        add_sample_data()
        
        print("Sample data added successfully!")

def add_sample_data():
    """Add sample data for testing"""
    
    # Sample Investors
    investor1 = Investor(name="Rajat Kumar", upi="rajat@paytm", family_group="Self", banks="HDFC Bank, SBI")
    investor2 = Investor(name="Priya Kumar", upi="priya@phonepe", family_group="Family", banks="ICICI Bank")
    investor3 = Investor(name="Amit Sharma", upi="amit@gpay", family_group="Family", banks="Axis Bank, HDFC Bank")
    investor4 = Investor(name="Neha Verma", upi="neha@paytm", family_group="Friends", banks="SBI")
    investor5 = Investor(name="Rohit Singh", upi="rohit@phonepe", family_group="Relatives", banks="Kotak Bank")
    
    db.session.add_all([investor1, investor2, investor3, investor4, investor5])
    db.session.commit()
    
    # Sample IPOs
    ipo1 = IPO(
        ipo_name="TechCorp Ltd",
        ipo_date=date(2024, 1, 15),
        num_shares=100,
        purchase_price_per_share=250.0,
        sale_price_per_share=320.0
    )
    
    ipo2 = IPO(
        ipo_name="GreenEnergy Solutions",
        ipo_date=date(2024, 2, 10),
        num_shares=75,
        purchase_price_per_share=180.0,
        sale_price_per_share=None  # Not sold yet
    )
    
    ipo3 = IPO(
        ipo_name="FinTech Innovations",
        ipo_date=date(2024, 3, 5),
        num_shares=50,
        purchase_price_per_share=500.0,
        sale_price_per_share=580.0
    )
    
    db.session.add_all([ipo1, ipo2, ipo3])
    db.session.commit()
    
    # Sample Applications
    app1 = Application(
        investor_id=investor1.id,
        ipo_id=ipo1.id,
        application_amount=25000.0,
        status="Allotted",
        payment_status="Received"
    )
    
    app2 = Application(
        investor_id=investor2.id,
        ipo_id=ipo1.id,
        application_amount=25000.0,
        status="Allotted",
        payment_status="Pending"
    )
    
    app3 = Application(
        investor_id=investor3.id,
        ipo_id=ipo1.id,
        application_amount=25000.0,
        status="Not Allotted",
        payment_status="Pending"
    )
    
    app4 = Application(
        investor_id=investor1.id,
        ipo_id=ipo2.id,
        application_amount=13500.0,
        status="Allotted",
        payment_status="Pending"
    )
    
    app5 = Application(
        investor_id=investor4.id,
        ipo_id=ipo2.id,
        application_amount=13500.0,
        status="Applied",
        payment_status="Pending"
    )
    
    app6 = Application(
        investor_id=investor5.id,
        ipo_id=ipo3.id,
        application_amount=25000.0,
        status="Allotted",
        payment_status="Received"
    )
    
    db.session.add_all([app1, app2, app3, app4, app5, app6])
    db.session.commit()
    
    print(f"Added {Investor.query.count()} investors")
    print(f"Added {IPO.query.count()} IPOs")
    print(f"Added {Application.query.count()} applications")

if __name__ == '__main__':
    init_database()
