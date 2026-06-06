#!/usr/bin/env python3
"""
Migration script to add new columns to existing database
"""

import sqlite3
import os

def migrate_database():
    db_path = 'db_v2.sqlite'
    
    if not os.path.exists(db_path):
        print(f"Database file {db_path} not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check existing tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [table[0] for table in cursor.fetchall()]
        print(f"Found tables: {tables}")
        
        # Check if application table exists
        if 'application' in tables:
            # Get current columns
            cursor.execute("PRAGMA table_info(application)")
            columns = [column[1] for column in cursor.fetchall()]
            print(f"Current application columns: {columns}")
            
            # Add new columns if they don't exist
            if 'funding_source' not in columns:
                cursor.execute("ALTER TABLE application ADD COLUMN f