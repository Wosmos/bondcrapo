"""
Quick test script for FastAPI server
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"✅ Health: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_stats():
    """Test stats endpoint"""
    print("\n🔍 Testing stats endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/stats")
        data = response.json()
        print(f"✅ Stats:")
        print(f"   Total winners: {data['total_winners']:,}")
        print(f"   Denominations: {len(data['by_denomination'])}")
        return True
    except Exception as e:
        print(f"❌ Stats failed: {e}")
        return False

def test_search():
    """Test search endpoint"""
    print("\n🔍 Testing search endpoint...")
    try:
        # Search for a common number pattern
        response = requests.get(f"{BASE_URL}/api/search?number=100000")
        data = response.json()
        print(f"✅ Search for 100000:")
        print(f"   Total wins: {data['total_wins']}")
        return True
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return False

def test_draws():
    """Test draws endpoint"""
    print("\n🔍 Testing draws endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/draws?limit=10")
        data = response.json()
        print(f"✅ Draws:")
        print(f"   Total: {data['total']:,}")
        print(f"   Returned: {len(data['draws'])}")
        return True
    except Exception as e:
        print(f"❌ Draws failed: {e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("🧪 FASTAPI SERVER TEST")
    print("="*60)
    print("\nMake sure the server is running at http://localhost:8000")
    print("Run: python app.py\n")
    
    input("Press Enter to start tests...")
    
    results = []
    results.append(("Health", test_health()))
    results.append(("Stats", test_stats()))
    results.append(("Search", test_search()))
    results.append(("Draws", test_draws()))
    
    print("\n" + "="*60)
    print("📊 TEST RESULTS")
    print("="*60)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    print(f"\n{passed}/{total} tests passed")
    print("="*60)
