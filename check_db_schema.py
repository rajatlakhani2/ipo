#!/usr/bin/env python3
"""
Check database schema
"""

import sqlite3
import os

def check_schema():
    db_path = 'db_v2.sqlite'
    
    if not os.path.exists(db_path):
        print(f"Database file {db_path} not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        print("Tables in database:")
        for table in tables:
            print(f"  - {table[0]}")
            
            # Get columns for each table
            cursor.execute(f"PRAGMA table_info({table[0]})")
            columns = cursor.fetchall()
            
            print("    Columns:")
            for col in columns:
                print(f"      {col[1]} ({col[2]})")
            print()
        
    except Exception as e:
        print(f"Error: {e}")
    
    finally:
        conn.close()

if __name__ == "__main__":
    check_schema()