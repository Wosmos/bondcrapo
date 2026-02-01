"""
Prize Bond Data Parser
Converts raw TXT files to SQL database, CSV, and JSON

Processing:
1. Parses all TXT files from raw_data/
2. Extracts winning numbers
3. Saves to SQLite database (MUST)
4. Exports to CSV and JSON (parallel)
"""

import os
import re
import json
import csv
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import threading

class PrizeBondParser:
    """Parse raw prize bond data files"""
    
    # Prize structure
    PRIZE_STRUCTURE = {
        100: {'1st': {'amount': 700000, 'count': 1}, '2nd': {'amount': 200000, 'count': 3}, '3rd': {'amount': 1000, 'count': 1199}},
        200: {'1st': {'amount': 750000, 'count': 1}, '2nd': {'amount': 250000, 'count': 5}, '3rd': {'amount': 1250, 'count': 2394}},
        750: {'1st': {'amount': 1500000, 'count': 1}, '2nd': {'amount': 500000, 'count': 3}, '3rd': {'amount': 9300, 'count': 1696}},
        1500: {'1st': {'amount': 3000000, 'count': 1}, '2nd': {'amount': 1000000, 'count': 3}, '3rd': {'amount': 18500, 'count': 1696}},
        7500: {'1st': {'amount': 15000000, 'count': 1}, '2nd': {'amount': 5000000, 'count': 3}, '3rd': {'amount': 93000, 'count': 1696}},
        15000: {'1st': {'amount': 30000000, 'count': 1}, '2nd': {'amount': 10000000, 'count': 3}, '3rd': {'amount': 185000, 'count': 1696}},
        25000: {'1st': {'amount': 50000000, 'count': 1}, '2nd': {'amount': 15000000, 'count': 3}, '3rd': {'amount': 312000, 'count': 1696}},
        40000: {'1st': {'amount': 75000000, 'count': 1}, '2nd': {'amount': 25000000, 'count': 3}, '3rd': {'amount': 500000, 'count': 1696}}
    }
    
    def __init__(self, raw_data_dir: str = "raw_data", output_dir: str = "parsed_data"):
        """Initialize parser"""
        self.raw_data_dir = raw_data_dir
        self.output_dir = output_dir
        
        self.setup_directories()
        self.setup_logging()
        self.setup_database()
        
        # Statistics
        self.stats = {
            'files_processed': 0,
            'files_failed': 0,
            'total_winners': 0
        }
        self.lock = threading.Lock()
    
    def setup_directories(self):
        """Create output directories"""
        dirs = [
            self.output_dir,
            f"{self.output_dir}/csv",
            f"{self.output_dir}/json",
            f"{self.output_dir}/logs"
        ]
        for d in dirs:
            os.makedirs(d, exist_ok=True)
    
    def setup_logging(self):
        """Setup logging"""
        log_file = f"{self.output_dir}/logs/parser_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def setup_database(self):
        """Create SQLite database and tables"""
        db_path = f"{self.output_dir}/prize_bonds.db"
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.cursor = self.conn.cursor()
        
        # Create winners table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS winners (
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
            )
        ''')
        
        # Create indexes
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_bond_number ON winners(bond_number)')
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_denomination ON winners(denomination)')
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_draw_date ON winners(draw_date)')
        
        self.conn.commit()
        
        self.logger.info(f"Database initialized: {db_path}")
        print(f"✅ Database: {db_path}")
    
    def parse_txt_file(self, filepath: str, metadata: Dict) -> List[Dict]:
        """Parse a single TXT file and extract winners"""
        try:
            # Read file with multiple encoding attempts
            content = None
            for encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
                try:
                    with open(filepath, 'r', encoding=encoding) as f:
                        content = f.read()
                    break
                except:
                    continue
            
            if not content:
                raise Exception("Could not read file")
            
            denomination = metadata['denomination']
            
            if denomination not in self.PRIZE_STRUCTURE:
                raise Exception(f"Unknown denomination: {denomination}")
            
            # Extract all 6-digit numbers
            all_numbers = re.findall(r'\b\d{6}\b', content)
            
            if not all_numbers:
                raise Exception("No numbers found")
            
            # Remove duplicates while preserving order
            seen = set()
            unique_numbers = []
            for num in all_numbers:
                if num not in seen:
                    seen.add(num)
                    unique_numbers.append(num)
            
            # Parse based on prize structure
            expected_2nd = self.PRIZE_STRUCTURE[denomination]['2nd']['count']
            
            first_prize = unique_numbers[0] if len(unique_numbers) > 0 else None
            second_prizes = unique_numbers[1:1+expected_2nd] if len(unique_numbers) > expected_2nd else []
            third_prizes = unique_numbers[1+expected_2nd:] if len(unique_numbers) > (1+expected_2nd) else []
            
            # Create winner records
            winners = []
            
            if first_prize:
                winners.append({
                    'source': metadata.get('source', 'unknown'),
                    'denomination': denomination,
                    'draw_date': metadata.get('date', ''),
                    'draw_year': metadata.get('year', ''),
                    'bond_number': first_prize,
                    'prize_position': '1st',
                    'prize_amount': self.PRIZE_STRUCTURE[denomination]['1st']['amount']
                })
            
            for num in second_prizes:
                winners.append({
                    'source': metadata.get('source', 'unknown'),
                    'denomination': denomination,
                    'draw_date': metadata.get('date', ''),
                    'draw_year': metadata.get('year', ''),
                    'bond_number': num,
                    'prize_position': '2nd',
                    'prize_amount': self.PRIZE_STRUCTURE[denomination]['2nd']['amount']
                })
            
            for num in third_prizes:
                winners.append({
                    'source': metadata.get('source', 'unknown'),
                    'denomination': denomination,
                    'draw_date': metadata.get('date', ''),
                    'draw_year': metadata.get('year', ''),
                    'bond_number': num,
                    'prize_position': '3rd',
                    'prize_amount': self.PRIZE_STRUCTURE[denomination]['3rd']['amount']
                })
            
            return winners
            
        except Exception as e:
            self.logger.error(f"Error parsing {filepath}: {e}")
            return []
    
    def insert_to_database(self, winners: List[Dict]):
        """Insert winners to database"""
        if not winners:
            return
        
        with self.lock:
            for winner in winners:
                try:
                    self.cursor.execute('''
                        INSERT OR IGNORE INTO winners 
                        (source, denomination, draw_date, draw_year, bond_number, prize_position, prize_amount)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        winner['source'],
                        winner['denomination'],
                        winner['draw_date'],
                        winner['draw_year'],
                        winner['bond_number'],
                        winner['prize_position'],
                        winner['prize_amount']
                    ))
                except Exception as e:
                    self.logger.error(f"Database insert error: {e}")
            
            self.conn.commit()
    
    def process_file(self, filepath: str, metadata_file: str) -> int:
        """Process a single file"""
        try:
            # Load metadata
            metadata = {}
            if os.path.exists(metadata_file):
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
            else:
                # Try to extract from filename
                filename = os.path.basename(filepath)
                parts = filename.replace('.txt', '').split('_')
                if parts:
                    try:
                        metadata['denomination'] = int(parts[0])
                        metadata['date'] = '_'.join(parts[1:])
                    except:
                        pass
            
            # Parse file
            winners = self.parse_txt_file(filepath, metadata)
            
            if winners:
                # Insert to database
                self.insert_to_database(winners)
                
                with self.lock:
                    self.stats['files_processed'] += 1
                    self.stats['total_winners'] += len(winners)
                
                return len(winners)
            else:
                with self.lock:
                    self.stats['files_failed'] += 1
                return 0
                
        except Exception as e:
            self.logger.error(f"Error processing {filepath}: {e}")
            with self.lock:
                self.stats['files_failed'] += 1
            return 0
    
    def parse_all_files(self, max_workers: int = 10):
        """Parse all files in parallel"""
        print("\n" + "="*80)
        print("📄 PARSING RAW DATA FILES")
        print("="*80)
        
        # Collect all TXT files
        all_files = []
        
        for source_dir in ['savings_gov_pk', 'prizeinfo_net', 'pakbond_com']:
            source_path = f"{self.raw_data_dir}/{source_dir}"
            if not os.path.exists(source_path):
                continue
            
            for filename in os.listdir(source_path):
                if filename.endswith('.txt'):
                    filepath = f"{source_path}/{filename}"
                    metadata_file = f"{self.raw_data_dir}/metadata/{filename}.json"
                    all_files.append((filepath, metadata_file))
        
        print(f"📋 Found {len(all_files)} files to parse")
        print(f"⚡ Using {max_workers} workers\n")
        
        start_time = datetime.now()
        
        # Process in parallel
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(self.process_file, fp, mf): fp for fp, mf in all_files}
            
            for i, future in enumerate(as_completed(futures), 1):
                winners_count = future.result()
                print(f"\r[{i}/{len(all_files)}] Processed | Winners: {self.stats['total_winners']:,}", end="", flush=True)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        
        print(f"\n\n{'='*80}")
        print("✅ PARSING COMPLETED!")
        print("="*80)
        print(f"⏱️  Time: {elapsed:.1f}s")
        print(f"✓ Files processed: {self.stats['files_processed']}")
        print(f"✗ Files failed: {self.stats['files_failed']}")
        print(f"🏆 Total winners: {self.stats['total_winners']:,}")
        print("="*80)
    
    def export_to_csv(self):
        """Export database to CSV (parallel by denomination)"""
        print("\n📊 Exporting to CSV...")
        
        def export_denomination(denom):
            csv_file = f"{self.output_dir}/csv/winners_{denom}.csv"
            
            cursor = self.conn.cursor()
            cursor.execute('''
                SELECT source, denomination, draw_date, draw_year, bond_number, prize_position, prize_amount
                FROM winners
                WHERE denomination = ?
                ORDER BY draw_date DESC
            ''', (denom,))
            
            rows = cursor.fetchall()
            
            if rows:
                with open(csv_file, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(['source', 'denomination', 'draw_date', 'draw_year', 'bond_number', 'prize_position', 'prize_amount'])
                    writer.writerows(rows)
                
                print(f"  ✓ {csv_file} ({len(rows):,} records)")
        
        # Export each denomination in parallel
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(export_denomination, d) for d in self.PRIZE_STRUCTURE.keys()]
            for future in as_completed(futures):
                future.result()
        
        # Export combined CSV
        csv_file = f"{self.output_dir}/csv/all_winners.csv"
        cursor = self.conn.cursor()
        cursor.execute('SELECT source, denomination, draw_date, draw_year, bond_number, prize_position, prize_amount FROM winners')
        rows = cursor.fetchall()
        
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['source', 'denomination', 'draw_date', 'draw_year', 'bond_number', 'prize_position', 'prize_amount'])
            writer.writerows(rows)
        
        print(f"  ✓ {csv_file} ({len(rows):,} records)")
    
    def export_to_json(self):
        """Export database to JSON (parallel by denomination)"""
        print("\n📦 Exporting to JSON...")
        
        def export_denomination(denom):
            json_file = f"{self.output_dir}/json/winners_{denom}.json"
            
            cursor = self.conn.cursor()
            cursor.execute('''
                SELECT source, denomination, draw_date, draw_year, bond_number, prize_position, prize_amount
                FROM winners
                WHERE denomination = ?
                ORDER BY draw_date DESC
            ''', (denom,))
            
            rows = cursor.fetchall()
            
            if rows:
                data = [
                    {
                        'source': r[0],
                        'denomination': r[1],
                        'draw_date': r[2],
                        'draw_year': r[3],
                        'bond_number': r[4],
                        'prize_position': r[5],
                        'prize_amount': r[6]
                    }
                    for r in rows
                ]
                
                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                
                print(f"  ✓ {json_file} ({len(rows):,} records)")
        
        # Export each denomination in parallel
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(export_denomination, d) for d in self.PRIZE_STRUCTURE.keys()]
            for future in as_completed(futures):
                future.result()
    
    def close(self):
        """Close database connection"""
        self.conn.close()


def main():
    """Main function"""
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    PRIZE BOND DATA PARSER                                    ║
║            Converts Raw TXT → SQL Database + CSV + JSON                      ║
╚══════════════════════════════════════════════════════════════════════════════╝
""")
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    RAW_DIR = os.path.join(BASE_DIR, '..', 'database', 'raw_data')
    OUT_DIR = os.path.join(BASE_DIR, '..', 'database')

    parser = PrizeBondParser(
        raw_data_dir=RAW_DIR,
        output_dir=OUT_DIR
    )
    
    # Parse files
    parser.parse_all_files(max_workers=10)
    
    # Export to CSV and JSON in parallel
    print("\n" + "="*80)
    print("📤 EXPORTING DATA")
    print("="*80)
    
    with ThreadPoolExecutor(max_workers=2) as executor:
        csv_future = executor.submit(parser.export_to_csv)
        json_future = executor.submit(parser.export_to_json)
        
        csv_future.result()
        json_future.result()
    
    parser.close()
    
    print("\n" + "="*80)
    print("🎉 ALL DONE!")
    print("="*80)
    print(f"📂 Database: parsed_data/prize_bonds.db")
    print(f"📊 CSV files: parsed_data/csv/")
    print(f"📦 JSON files: parsed_data/json/")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()