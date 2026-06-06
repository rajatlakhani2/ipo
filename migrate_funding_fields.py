#!/usr/bin/env python3
"""
Migration script to add funding source fields to applications table
and create money_transfer table
"""

import sqlite3
import os

def migrate_database():
    # Use the same database file as the app
    db_path = 'db_v2.sqlite'
    
    if not os.path.exists(db_path):
        print(f"Database file {db_path} not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Add new columns to applications table
        print("Adding funding source columns to applications table...")
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(application)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'funding_source' not in columns:
            cursor.execute("ALTER TABLE application ADD COLUMN funding_source TEXT DEFAULT 'Own'")
            print("Added funding_source column")
        
        if 'lender_name' not in columns:
            cursor.execute("ALTER TABLE application ADD COLUMN lender_name TEXT")
            print("Added lender_name column")
        
        if 'repayment_status' not in columns:
            cursor.execute("ALTER TABLE application ADD COLUMN repayment_status TEXT DEFAULT 'N/A'")
            print("Added repayment_status column")
        
        # Create money_transfer table
        print("Creating money_transfer table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS money_transfer (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_person TEXT NOT NULL,
                to_person TEXT NOT NULL,
                amount REAL NOT NULL,
                purpose TEXT,
                transfer_date DATE DEFAULT CURRENT_DATE,
                repayment_status TEXT DEFAULT 'Pending',
                repayment_date DATE,
                notes TEXT
            )
        """)
        print("Created money_transfer table")
        
        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()