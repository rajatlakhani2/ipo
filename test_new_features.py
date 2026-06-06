#!/usr/bin/env python3
"""
Test the new dashboard features
"""

import requests
import json

API_BASE = 'http://127.0.0.1:5001/api'

def test_endpoints():
    print("Testing new dashboard features...")
    
    try:
        # Test dashboard summary
        print("\n1. Testing dashboard summary...")
        response = requests.get(f'{API_BASE}/dashboard/summary')
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Dashboard summary: {data.get('total_applications', 0)} applications")
        else:
            print(f"   ✗ Dashboard summary failed: {response.status_code}")
        
        # Test funding summary
        print("\n2. Testing funding summary...")
        response = requests.get(f'{API_BASE}/reports/funding-summary')
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Funding summary: {len(data.get('funding_breakdown', []))} funding sources")
        else:
            print(f"   ✗ Funding summary failed: {response.status_code}")
        
        # Test money transfers
        print("\n3. Testing money transfers...")
        response = requests.get(f'{API_BASE}/money-transfers')
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Money transfers: {len(data)} transfers")
        else:
            print(f"   ✗ Money transfers failed: {response.status_code}")
        
        # Test bank stats
        print("\n4. Testing bank stats...")
        response = requests.get(f'{API_BASE}/reports/bank-stats')
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Bank stats: {len(data)} banks")
        else:
            print(f"   ✗ Bank stats failed: {response.status_code}")
            
        print("\n✅ All tests completed!")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")

if __name__ == "__main__":
    test_endpoints()