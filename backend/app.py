"""
FastAPI + HTMX Prize Bond Application
Modern server-side rendered web app with dynamic HTMX interactions
"""

from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import sqlite3
from datetime import datetime
from typing import Optional, List
import os
from pathlib import Path

# Initialize FastAPI app
app = FastAPI(
    title="BondCheck PRO",
    description="Prize Bond Data API with HTMX Frontend",
    version="2.0.0"
)

# Setup paths
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
DB_PATH = BASE_DIR.parent / "database" / "prize_bonds.db"

# Setup Jinja2 templates
templates = Jinja2Templates(directory=str(FRONTEND_DIR))

# Mount static files - must be AFTER route definitions to avoid conflicts
# We'll add this after the routes

# Database helper
def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

# ==================== HTMX ENDPOINTS ====================

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serve main page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/stats")
async def get_stats():
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
        
        return {
            'total_winners': total,
            'by_denomination': by_denomination,
            'by_position': by_position,
            'last_update': last_update
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search")
async def search_bond(number: str = Query(..., min_length=6, max_length=6)):
    """Search for a bond number"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT source, denomination, draw_date, draw_year, bond_number, 
                   prize_position, prize_amount
            FROM winners
            WHERE bond_number = ?
            ORDER BY draw_date DESC
        ''', (number,))
        
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return {
            'bond_number': number,
            'wins': results,
            'total_wins': len(results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/draws")
async def get_draws(
    denomination: Optional[int] = None,
    limit: int = Query(50, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    position: Optional[str] = None,
    year: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    min_amount: Optional[int] = None,
    max_amount: Optional[int] = None,
    bond_number: Optional[str] = None,
    bond_list: Optional[str] = None,
    start_bond: Optional[str] = None,
    end_bond: Optional[str] = None,
    sort_by: str = Query('draw_date', pattern='^(bond_number|draw_date|prize_amount|denomination)$'),
    sort_order: str = Query('DESC', pattern='^(ASC|DESC)$')
):
    """Get draws with advanced filtering"""
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
        
        if position:
            base_query += ' AND prize_position = ?'
            params.append(position)

        if year:
            base_query += ' AND draw_year = ?'
            params.append(year)
        
        # SQLite date conversion for range filtering
        sql_date = "substr(draw_date, 7, 4) || '-' || substr(draw_date, 4, 2) || '-' || substr(draw_date, 1, 2)"
        
        if start_date:
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
        
        # Sorting logic
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
        
        return {
            'draws': results,
            'total': total,
            'limit': limit,
            'offset': offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/latest")
async def get_latest(denomination: Optional[int] = None):
    """Get latest draws"""
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
        
        return {'latest_draws': results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/check-multiple")
async def check_multiple(request: Request):
    """Check multiple bond numbers at once"""
    try:
        data = await request.json()
        numbers = data.get('numbers', [])
        
        if not numbers or len(numbers) > 100:
            raise HTTPException(status_code=400, detail='Provide 1-100 bond numbers')
        
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
        
        return {
            'results': results,
            'checked': len(numbers),
            'winners': len(results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    db_exists = DB_PATH.exists()
    return {
        "status": "healthy" if db_exists else "degraded",
        "database": "connected" if db_exists else "not found",
        "timestamp": datetime.now().isoformat()
    }

# Static file routes - serve individual files

@app.get("/style.css")
async def get_style():
    """Serve CSS file"""
    return FileResponse(str(FRONTEND_DIR / "style.css"), media_type="text/css")

@app.get("/script.js")
async def get_script():
    """Serve JS file"""
    return FileResponse(str(FRONTEND_DIR / "script.js"), media_type="application/javascript")

@app.get("/tailwind.js")
async def get_tailwind():
    """Serve Tailwind config"""
    return FileResponse(str(FRONTEND_DIR / "tailwind.js"), media_type="application/javascript")

if __name__ == "__main__":
    import uvicorn
    
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    BONDCHECK PRO - FASTAPI SERVER                            ║
║                  Modern HTMX + FastAPI Application                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)
    
    if not DB_PATH.exists():
        print(f"\n❌ ERROR: Database not found at {DB_PATH}")
        print("Please run parser.py first to create the database.\n")
        exit(1)
    
    print(f"\n✅ Database found: {DB_PATH}")
    print("\n🌐 Server starting...")
    print("📍 URL: http://localhost:8000")
    print("📍 API Docs: http://localhost:8000/docs")
    print("📍 ReDoc: http://localhost:8000/redoc")
    print("\nPress Ctrl+C to stop\n")
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
