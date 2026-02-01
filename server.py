"""
Prize Bond Data Server
Serves data from SQLite database via REST API

Endpoints:
- GET /api/search?number=123456
- GET /api/draws?denomination=100&limit=10
- GET /api/stats
- GET /api/latest?denomination=100
- GET / (serves index.html)
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import sqlite3
from datetime import datetime
import os

app = Flask(__name__, static_folder='.')
CORS(app)

DB_PATH = "parsed_data/prize_bonds.db"

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    """Serve index.html"""
    return send_from_directory('.', 'index.html')

@app.route('/api/search', methods=['GET'])
def search_bond():
    """Search for a bond number"""
    bond_number = request.args.get('number', '').strip()
    
    if not bond_number or len(bond_number) != 6:
        return jsonify({'error': 'Invalid bond number. Must be 6 digits.'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT source, denomination, draw_date, draw_year, bond_number, 
                   prize_position, prize_amount
            FROM winners
            WHERE bond_number = ?
            ORDER BY draw_date DESC
        ''', (bond_number,))
        
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'bond_number': bond_number,
            'wins': results,
            'total_wins': len(results)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/draws', methods=['GET'])
def get_draws():
    """Get draws for a denomination"""
    denomination = request.args.get('denomination', type=int)
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    prize_position = request.args.get('position', '')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = 'SELECT * FROM winners WHERE 1=1'
        params = []
        
        if denomination:
            query += ' AND denomination = ?'
            params.append(denomination)
        
        if prize_position:
            query += ' AND prize_position = ?'
            params.append(prize_position)
        
        query += ' ORDER BY draw_date DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        results = [dict(row) for row in cursor.fetchall()]
        
        # Get total count
        count_query = 'SELECT COUNT(*) as total FROM winners WHERE 1=1'
        count_params = []
        
        if denomination:
            count_query += ' AND denomination = ?'
            count_params.append(denomination)
        
        if prize_position:
            count_query += ' AND prize_position = ?'
            count_params.append(prize_position)
        
        cursor.execute(count_query, count_params)
        total = cursor.fetchone()['total']
        
        conn.close()
        
        return jsonify({
            'draws': results,
            'total': total,
            'limit': limit,
            'offset': offset
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/latest', methods=['GET'])
def get_latest():
    """Get latest draws"""
    denomination = request.args.get('denomination', type=int)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if denomination:
            cursor.execute('''
                SELECT DISTINCT draw_date, draw_year, denomination
                FROM winners
                WHERE denomination = ?
                ORDER BY draw_date DESC
                LIMIT 10
            ''', (denomination,))
        else:
            cursor.execute('''
                SELECT DISTINCT draw_date, draw_year, denomination
                FROM winners
                ORDER BY draw_date DESC
                LIMIT 20
            ''')
        
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({'latest_draws': results})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get database statistics"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Total winners
        cursor.execute('SELECT COUNT(*) as total FROM winners')
        total = cursor.fetchone()['total']
        
        # By denomination
        cursor.execute('''
            SELECT denomination, COUNT(*) as count, SUM(prize_amount) as total_amount
            FROM winners
            GROUP BY denomination
        ''')
        by_denomination = [dict(row) for row in cursor.fetchall()]
        
        # By prize position
        cursor.execute('''
            SELECT prize_position, COUNT(*) as count, SUM(prize_amount) as total_amount
            FROM winners
            GROUP BY prize_position
        ''')
        by_position = [dict(row) for row in cursor.fetchall()]
        
        # Latest update
        cursor.execute('SELECT MAX(created_at) as last_update FROM winners')
        last_update = cursor.fetchone()['last_update']
        
        conn.close()
        
        return jsonify({
            'total_winners': total,
            'by_denomination': by_denomination,
            'by_position': by_position,
            'last_update': last_update
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/check-multiple', methods=['POST'])
def check_multiple():
    """Check multiple bond numbers at once"""
    data = request.get_json()
    numbers = data.get('numbers', [])
    
    if not numbers or len(numbers) > 100:
        return jsonify({'error': 'Provide 1-100 bond numbers'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        placeholders = ','.join(['?' for _ in numbers])
        cursor.execute(f'''
            SELECT bond_number, denomination, draw_date, prize_position, prize_amount
            FROM winners
            WHERE bond_number IN ({placeholders})
            ORDER BY bond_number, draw_date DESC
        ''', numbers)
        
        results = {}
        for row in cursor.fetchall():
            row_dict = dict(row)
            bond_num = row_dict['bond_number']
            if bond_num not in results:
                results[bond_num] = []
            results[bond_num].append(row_dict)
        
        conn.close()
        
        return jsonify({
            'results': results,
            'checked': len(numbers),
            'winners': len(results)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    PRIZE BOND DATA SERVER                                    ║
║                  REST API + Frontend Server                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)
    
    if not os.path.exists(DB_PATH):
        print(f"\n❌ ERROR: Database not found at {DB_PATH}")
        print("Please run parser.py first to create the database.\n")
        exit(1)
    
    print(f"\n✅ Database found: {DB_PATH}")
    print("\n🌐 Server starting...")
    print("📍 URL: http://localhost:5000")
    print("\n📡 API Endpoints:")
    print("  GET  /api/search?number=123456")
    print("  GET  /api/draws?denomination=100&limit=10")
    print("  GET  /api/latest?denomination=100")
    print("  GET  /api/stats")
    print("  POST /api/check-multiple")
    print("\n🌐 Frontend: http://localhost:5000/")
    print("\nPress Ctrl+C to stop\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)