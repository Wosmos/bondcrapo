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

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Use absolute path for robustness
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, '..', 'database', 'prize_bonds.db')

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    """Serve index.html"""
    return send_from_directory(app.static_folder, 'index.html')

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
    """Get draws with advanced filtering and sorting"""
    denomination = request.args.get('denomination', type=int)
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    prize_position = request.args.get('position', '')
    year = request.args.get('year', '')
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    min_amount = request.args.get('min_amount', type=int)
    max_amount = request.args.get('max_amount', type=int)
    bond_number = request.args.get('bond_number', '')
    bond_list = request.args.get('bond_list', '') # Comma-separated list for random checking
    start_bond = request.args.get('start_bond', '') # Bulk series start
    end_bond = request.args.get('end_bond', '') # Bulk series end
    sort_by = request.args.get('sort_by', 'draw_date')
    sort_order = request.args.get('sort_order', 'DESC').upper()

    # Validate sort order and column
    valid_sort_cols = ['bond_number', 'draw_date', 'prize_amount', 'denomination']
    if sort_by not in valid_sort_cols:
        sort_by = 'draw_date'
    if sort_order not in ['ASC', 'DESC']:
        sort_order = 'DESC'
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        base_query = 'FROM winners WHERE 1=1'
        params = []
        
        # Bond Filtering (Grouped with OR for multi-mode search)
        bond_filters = []
        bond_params = []

        if bond_number:
            bond_filters.append('bond_number LIKE ?')
            bond_params.append(f'{bond_number}%')
            
        if bond_list:
            bonds = [b.strip() for b in bond_list.split(',') if b.strip()]
            if bonds:
                placeholders = ','.join(['?'] * len(bonds))
                bond_filters.append(f'bond_number IN ({placeholders})')
                bond_params.extend(bonds)
                
        if start_bond and end_bond:
            bond_filters.append('CAST(bond_number AS INTEGER) BETWEEN ? AND ?')
            bond_params.append(start_bond)
            bond_params.append(end_bond)
        elif start_bond:
            bond_filters.append('CAST(bond_number AS INTEGER) >= ?')
            bond_params.append(start_bond)
        elif end_bond:
            bond_filters.append('CAST(bond_number AS INTEGER) <= ?')
            bond_params.append(end_bond)

        if bond_filters:
            base_query += f" AND ({' OR '.join(bond_filters)})"
            params.extend(bond_params)
        
        if denomination:
            base_query += ' AND denomination = ?'
            params.append(denomination)
        
        if prize_position:
            base_query += ' AND prize_position = ?'
            params.append(prize_position)

        if year:
            base_query += ' AND draw_year = ?'
            params.append(year)
        
        # SQLite date conversion for range filtering: 'DD-MM-YYYY' -> 'YYYY-MM-YYYY' for comparison
        # We use substr(col, 7, 4) || '-' || substr(col, 4, 2) || '-' || substr(col, 1, 2)
        sql_date = "substr(draw_date, 7, 4) || '-' || substr(draw_date, 4, 2) || '-' || substr(draw_date, 1, 2)"
        
        if start_date:
            # Assuming start_date comes as YYYY-MM-DD from HTML5 date input
            base_query += f' AND {sql_date} >= ?'
            params.append(start_date)
        
        if end_date:
            base_query += f' AND {sql_date} <= ?'
            params.append(end_date)

        if min_amount:
            base_query += ' AND prize_amount >= ?'
            params.append(min_amount)
        
        if max_amount:
            base_query += ' AND prize_amount <= ?'
            params.append(max_amount)
        
        # Sorting logic enhancement
        sort_col = sort_by
        if sort_by == 'draw_date':
            sort_col = sql_date
            
        # Get results
        query = f'SELECT * {base_query} ORDER BY {sort_col} {sort_order} LIMIT ? OFFSET ?'
        result_params = params + [limit, offset]
        
        cursor.execute(query, result_params)
        results = [dict(row) for row in cursor.fetchall()]
        
        # Get total count
        cursor.execute(f'SELECT COUNT(*) as total {base_query}', params)
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