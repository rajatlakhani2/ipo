import requests
import json

BASE_URL = 'http://127.0.0.1:5001/api'

def test_reports():
    print("Testing Report APIs...")
    
    # Test Bank Stats
    print("\n1. Testing Bank Stats...")
    try:
        res = requests.get(f'{BASE_URL}/reports/bank-stats')
        print(f"Status Code: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print(f"Received {len(data)} bank records")
            if len(data) > 0:
                print("Sample record:", data[0])
        else:
            print("Failed to get bank stats")
            print(res.text)
    except Exception as e:
        print(f"Error testing bank stats: {e}")

    # Test IPO Profit
    print("\n2. Testing IPO Profit...")
    try:
        res = requests.get(f'{BASE_URL}/reports/ipo-profit')
        print(f"Status Code: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print(f"Received {len(data)} IPO records")
            if len(data) > 0:
                print("Sample record:", data[0])
        else:
            print("Failed to get IPO profit stats")
            print(res.text)
    except Exception as e:
        print(f"Error testing IPO profit: {e}")

if __name__ == '__main__':
    test_reports()
