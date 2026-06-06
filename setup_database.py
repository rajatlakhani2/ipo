#!/usr/bin/env python3
"""
Setup database with basic tables first
"""

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db_v2.sqlite'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Basic models without new columns
class Investor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    upi = db.Column(db.String(100))
    family_group = db.Column(db.String(50))
    banks = db.Column(db.String(500))

class IPO(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ipo_name = db.Column(db.String(200), nullable=False)
    ipo_type = db.Column(db.String(50))
    status = db.Column(db.String(50))
    ipo_date = db.Column(db.Date)
    listing_date = db.Column(db.Date)
    num_shares = db.Column(db.Integer)
    purchase_price_per_share = db.Column(db.Float)
    sale_price_per_share = db.Column(db.Float, nullable=True)

class Application(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    investor_id = db.Column(db.Integer, db.ForeignKey('investor.id'), nullable=False)
    ipo_id = db.Column(db.Integer, db.ForeignKey('ipo.id'), nullable=False)
    application_amount = db.Column(db.Float)
    status = db.Column(db.String(50))
    payment_status = db.Column(db.String(50))
    bank_name = db.Column(db.String(100))
    sell_price = db.Column(db.Float, nullable=True)

def setup_database():
    print("Setting up basic database tables...")
    with app.app_context():
        db.create_all()
        print("✅ Basic tables created successfully!")

if __name__ == "__main__":
    setup_database()