#!/usr/bin/env python3
"""
Enhance database schema with new fields for profit tracking and payment status
"""

import sqlite3

def enhance_database():
    conn = sqlite3.connect('ipo_dashboard.db')
    cursor = conn.cursor()
    
    try:
        print("Enhancing database schema...")
        
        # Check existing columns in applications table
        cursor.execute("PRAGMA table_info(applications)")
        columns = [column[1] for column in cursor.fetchall()]
        print(f"Current application columns: {columns}")
        
        # Add new columns to applications table
        new_columns = [
            ('sale_price_per_share', 'REAL DEFAULT 0'),
            ('payment_received', 'TEXT DEFAULT "Pending"'),  # Pending, Received
            ('profit_amount', 'REAL DEFAULT 0'),
            ('upi_used', 'TEXT'),
            ('notes', 'TEXT')
        ]
        
        for column_name, column_def in new_columns:
            if column_name not in columns:
                cursor.execute(f"ALTER TABLE applications ADD COLUMN {column_name} {column_def}")
                print(f"✓ Added {column_name} column")
            else:
                print(f"- {column_name} already exists")
        
        # Add sale_price_per_share to ipos table if not exists
        cursor.execute("PRAGMA table_info(ipos)")
        ipo_columns = [column[1] for column in cursor.fetchall()]
        
        if 'sale_price_per_share' not in ipo_columns:
            cursor.execute("ALTER TABLE ipos ADD COLUMN sale_price_per_share REAL DEFAULT 0")
            print("✓ Added sale_price_per_share to ipos table")
        
        conn.commit()
        print("✅ Database enhancement completed successfully!")
        
    except Exception as e:
        print(f"❌ Error enhancing database: {e}")
        conn.rollback()
    
    finally:
        conn.close()

if __name__ == "__main__":
    enhance_database()