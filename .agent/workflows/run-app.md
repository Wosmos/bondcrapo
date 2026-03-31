---
description: Run the BondCheck PRO application
---

# BondCheck PRO - FastAPI + HTMX Application

## Initial Setup (First Time Only)

1. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

## Data Collection & Processing

2. Run the smart scraper (checks DB, only downloads new data)
   // turbo

```bash
cd backend
python main.py
```

3. Run the smart parser (checks DB, only parses new files)
   // turbo

```bash
cd backend
python parser.py
```

## Start the Application

4. Run the FastAPI server
   // turbo

```bash
cd backend
python app.py
```

Alternative: Use uvicorn directly with auto-reload

```bash
cd backend
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

## Access Points

- Frontend: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs
- API Docs (ReDoc): http://localhost:8000/redoc
- Health Check: http://localhost:8000/health

## Update Data (Incremental)

To fetch and parse new prize bond data:

5. Run scraper again (it will skip existing data)

```bash
cd backend
python main.py
```

6. Run parser again (it will skip already-parsed files)

```bash
cd backend
python parser.py
```

The scraper and parser are now smart - they check the database before processing and only handle new data!

## Notes

- The scraper uses 25 parallel workers for fast downloads
- The parser uses 10 parallel workers for fast processing
- Both tools maintain parallelism while avoiding duplicate work
- FastAPI provides async request handling for better performance
- The UI remains the same with the Onyx theme and all features intact
