import requests
import json
from datetime import datetime

BASE_URL = 'http://127.0.0.1:5002/api'

def test_api():
    print("Testing CA Dashboard API...")
    
    # 1. Add Client
    client_data = {
        'name': 'Test Client Ltd',
        'pan': 'ABCDE1234F',
        'gstin': '27ABCDE1234F1Z5',
        'email': 'test@example.com',
        'services': ['GST', 'ITR']
    }
    res = requests.post(f'{BASE_URL}/clients', json=client_data)
    print(f"Add Client: {res.status_code} - {res.json()}")
    if res.status_code != 201:
        return
    client_id = res.json()['id']
    
    # 2. Add Compliance
    comp_data = {
        'client_id': client_id,
        'title': 'GSTR-1 Oct 2023',
        'due_date': '2023-11-11',
        'status': 'Pending'
    }
    res = requests.post(f'{BASE_URL}/compliance', json=comp_data)
    print(f"Add Compliance: {res.status_code} - {res.json()}")
    
    # 3. Create Invoice
    inv_data = {
        'client_id': client_id,
        'invoice_number': 'INV-001',
        'invoice_date': '2023-11-01',
        'total_amount': 5000.0
    }
    res = requests.post(f'{BASE_URL}/invoices', json=inv_data)
    print(f"Create Invoice: {res.status_code} - {res.json()}")
    if res.status_code != 201:
        return
    invoice_id = res.json()['id']
    
    # 4. Add Receipt
    receipt_data = {
        'receipt_date': '2023-11-05',
        'amount': 2000.0,
        'payment_mode': 'UPI'
    }
    res = requests.post(f'{BASE_URL}/invoices/{invoice_id}/receipt', json=receipt_data)
    print(f"Add Receipt: {res.status_code} - {res.json()}")
    
    # 5. Get Dashboard Stats
    res = requests.get(f'{BASE_URL}/reports/dashboard')
    print(f"Dashboard Stats: {res.status_code} - {res.json()}")

if __name__ == '__main__':
    try:
        test_api()
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure the server is running on port 5002")
