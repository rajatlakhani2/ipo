#!/usr/bin/env python3
"""
Add default shares field to investors table for prefilling allotment shares
"""

import sqlite3

def enhance_investor_shares():
    conn = sqlite3.connect('ipo_dashboard.db')
    cursor = conn.cursor()
    
    try:
        print("Adding default shares field to investors...")
        
        # Check existing columns in investors table
        cursor.execute("PRAGMA table_info(investors)")
        columns = [column[1] for column in cursor.fetchall()]
        print(f"Current investor columns: {columns}")
        
        # Add default_shares column if not exists
        if 'default_shares' not in columns:
            cursor.execute("ALTER TABLE investors ADD COLUMN default_shares INTEGER DEFAULT 1")
            print("✓ Added default_shares column to investors table")
        else:
            print("- default_shares already exists")
        
        conn.commit()
        print("✅ Enhancement completed successfully!")
        
    except Exception as e:
        print(f"❌ Error enhancing database: {e}")
        conn.rollback()
    
    finally:
        conn.close()

if __name__ == "__main__":
    enhance_investor_shares()