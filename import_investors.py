#!/usr/bin/env python3
"""
Import investors from Excel template to the clean dashboard database
"""

import pandas as pd
import sqlite3
import os

def import_investors_from_excel():
    # Check for Excel files
    excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx')]
    
    if not excel_files:
        print("No Excel files found!")
        return
    
    print(f"Found Excel files: {excel_files}")
    
    # Use the first Excel file found
    excel_file = excel_files[0]
    print(f"Reading from: {excel_file}")
    
    try:
        # Read Excel file
        df = pd.read_excel(excel_file)
        print(f"Excel columns: {list(df.columns)}")
        print(f"Number of rows: {len(df)}")
        
        # Connect to database
        conn = sqlite3.connect('ipo_dashboard.db')
        cursor = conn.cursor()
        
        # Clear existing investors (optional)
        # cursor.execute('DELETE FROM investors')
        
        imported_count = 0
        
        for index, row in df.iterrows():
            try:
                # Map Excel columns to database fields
                name = str(row.get('Name', row.get('name', ''))).strip()
                upi = str(row.get('UPI ID', row.get('UPI', row.get('upi', '')))).strip()
                family_group = str(row.get('Family Group', row.get('Group', row.get('family_group', 'Family')))).strip()
                preferred_bank = str(row.get('Bank', row.get('Preferred Bank', row.get('preferred_bank', '')))).strip()
                
                # Skip empty names
                if not name or name == 'nan':
                    continue
                
                # Clean up 'nan' values
                if upi == 'nan':
                    upi = ''
                if family_group == 'nan':
                    family_group = 'Family'
                if preferred_bank == 'nan':
                    preferred_bank = ''
                
                # Check if investor already exists
                cursor.execute('SELECT id FROM investors WHERE name = ?', (name,))
                if cursor.fetchone():
                    print(f"Investor '{name}' already exists, skipping...")
                    continue
                
                # Insert investor
                cursor.execute('''
                    INSERT INTO investors (name, upi, family_group, preferred_bank)
                    VALUES (?, ?, ?, ?)
                ''', (name, upi, family_group, preferred_bank))
                
                imported_count += 1
                print(f"Imported: {name} | UPI: {upi} | Group: {family_group} | Bank: {preferred_bank}")
                
            except Exception as e:
                print(f"Error importing row {index}: {e}")
                continue
        
        conn.commit()
        conn.close()
        
        print(f"\n✅ Successfully imported {imported_count} investors!")
        
    except Exception as e:
        print(f"❌ Error reading Excel file: {e}")

if __name__ == "__main__":
    import_investors_from_excel()