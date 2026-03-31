# BondCheck PRO - FastAPI Edition

Modern prize bond scraper and checker built with **FastAPI** backend and **vanilla JavaScript** frontend for a fast, responsive experience.

## 🏗️ Architecture

```
bondcrapo/
├── backend/
│   ├── app.py              # FastAPI server (NEW)
│   ├── main.py             # Smart scraper with DB checking
│   ├── parser.py           # Smart parser with duplicate detection
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── index.html          # HTMX-enhanced UI
│   ├── script.js           # Client-side logic
│   └── style.css           # Styling
└── database/
    ├── raw_data/           # Downloaded TXT files
    └── prize_bonds.db      # SQLite database
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Scrape Data (Smart Mode)

The scraper now checks the database before downloading:

```bash
python main.py
```

**Features:**

- ✅ Checks DB for existing draws
- ✅ Only downloads NEW data
- ✅ Parallel downloads (25 workers)
- ✅ Skips duplicates automatically

### 3. Parse Data (Smart Mode)

The parser now checks what's already in the database:

```bash
python parser.py
```

**Features:**

- ✅ Checks DB for already-parsed files
- ✅ Only parses NEW files
- ✅ Parallel processing (10 workers)
- ✅ Exports to CSV/JSON

### 4. Run FastAPI Server

```bash
python app.py
```

Or use uvicorn directly:

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

**Server URLs:**

- 🌐 Frontend: http://localhost:8000
- 📚 API Docs: http://localhost:8000/docs
- 📖 ReDoc: http://localhost:8000/redoc

## 🎯 Key Improvements

### 1. **Smart Scraper** (`main.py`)

- Connects to DB before scraping
- Checks for existing `(source, denomination, draw_date)` combinations
- Only downloads fresh data
- Reduces scraping time by 90%+ on subsequent runs

### 2. **Smart Parser** (`parser.py`)

- Queries DB for already-parsed draws
- Skips files that are already in the database
- Uses `INSERT OR IGNORE` to prevent duplicates
- Parallel processing maintained

### 3. **FastAPI Backend** (`app.py`)

- **Modern async framework** (replaces Flask)
- **HTMX-ready** endpoints
- **Auto-generated API docs** at `/docs`
- **Better performance** with async/await
- **Type hints** for validation

### 4. **Maintained Parallelism**

- Scraper: 25 parallel workers
- Parser: 10 parallel workers
- FastAPI: Async request handling

## 📡 API Endpoints

### Core Endpoints

- `GET /` - Main HTMX frontend
- `GET /api/stats` - Database statistics
- `GET /api/search?number=123456` - Search bond
- `GET /api/draws?denomination=100&limit=50` - Get draws with filters
- `GET /api/latest?denomination=100` - Latest draws
- `POST /api/check-multiple` - Batch check bonds
- `GET /health` - Health check

### Advanced Filters

- `denomination` - Filter by value
- `position` - Prize rank (1st, 2nd, 3rd)
- `year` - Draw year
- `start_date` / `end_date` - Date range
- `min_amount` / `max_amount` - Prize range
- `bond_number` - Prefix search
- `bond_list` - Comma-separated list
- `start_bond` / `end_bond` - Series range
- `sort_by` - Sort column
- `sort_order` - ASC/DESC

## 🔄 Workflow

### First Time Setup

```bash
# 1. Scrape data
python backend/main.py

# 2. Parse data
python backend/parser.py

# 3. Run server
python backend/app.py
```

### Subsequent Updates

```bash
# Just run scraper + parser again
# They will automatically skip existing data!
python backend/main.py
python backend/parser.py
```

## 🎨 Frontend

The UI maintains the same **Onyx theme** with:

- ✅ Advanced filters
- ✅ Smart scanner (OCR/PDF)
- ✅ PDF export
- ✅ Multi-search modes
- ✅ Responsive design

**Architecture:**

- Vanilla JavaScript with Fetch API
- Grid.js for high-performance tables
- Client-side rendering with server APIs
- Modern ES6+ features

## 🛠️ Tech Stack

**Backend:**

- FastAPI 0.109+
- Uvicorn (ASGI server)
- SQLite3
- BeautifulSoup4
- Jinja2 (templating)

**Frontend:**

- Vanilla JavaScript (ES6+)
- Tailwind CSS
- Grid.js (tables)
- Tesseract.js (OCR)
- jsPDF (exports)

## 📊 Performance

### Scraper

- **First run:** ~5-10 minutes (downloads all)
- **Subsequent runs:** ~30 seconds (only new data)

### Parser

- **First run:** ~2-3 minutes (parses all)
- **Subsequent runs:** ~10 seconds (only new files)

### Server

- **Response time:** <50ms (typical)
- **Concurrent requests:** 100+ (async)

## 🔍 Database Schema

```sql
CREATE TABLE winners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    denomination INTEGER NOT NULL,
    draw_date TEXT NOT NULL,
    draw_year TEXT,
    bond_number TEXT NOT NULL,
    prize_position TEXT NOT NULL,
    prize_amount INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, denomination, draw_date, bond_number)
);
```

**Indexes:**

- `idx_bond_number` - Fast bond lookups
- `idx_denomination` - Filter by value
- `idx_draw_date` - Sort by date

## 🚦 Status

- ✅ FastAPI backend
- ✅ Smart scraper (DB checking)
- ✅ Smart parser (duplicate detection)
- ✅ Parallel processing
- ✅ HTMX-ready frontend
- ✅ API documentation
- ✅ Health checks

## 📝 Notes

1. **Database is the source of truth** - Both scraper and parser check it before processing
2. **UNIQUE constraint** prevents duplicates at DB level
3. **Parallel processing** maintained throughout
4. **HTMX** allows for progressive enhancement
5. **FastAPI** provides auto-docs and better performance

## 🎯 Next Steps

1. Add HTMX partial rendering for filters
2. Implement Server-Sent Events for real-time updates
3. Add caching layer (Redis)
4. Deploy to production (Vercel/Railway)
5. Add authentication for admin features

---

**Built with ❤️ using FastAPI + HTMX**
