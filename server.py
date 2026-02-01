import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path

app = FastAPI()

# Path to the data directory
DATA_DIR = Path("prize_bonds_data")

# Serve the data directory statically at /data
if DATA_DIR.exists():
    app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

# Serve static files for the frontend
app.mount("/assets", StaticFiles(directory="."), name="assets")

@app.get("/")
def get_index():
    return FileResponse("index.html")

@app.get("/index.css")
def get_css():
    return FileResponse("index.css")

@app.get("/index.js")
def get_js():
    return FileResponse("index.js")

if __name__ == "__main__":
    print("Pakistan Prize Bonds Data Portal")
    
    uvicorn.run(app, host="0.0.0.0", port=8080)
