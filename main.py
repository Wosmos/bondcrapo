"""
Multi-Source Prize Bond Scraper
Fetches raw data from multiple sources (1998-2026)

Sources:
1. savings.gov.pk (2019-2026, active bonds)
2. prizeinfo.net (2010-2026, includes discontinued)
3. pakbond.com (2000-2026, historical data)

Stores raw TXT files for parsing
"""

import requests
from bs4 import BeautifulSoup
import os
import time
import json
from datetime import datetime
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import threading
import re

class MultiSourceScraper:
    """Scraper for multiple prize bond data sources"""
    
    # All denominations (including discontinued)
    ALL_DENOMINATIONS = [100, 200, 750, 1500, 7500, 15000, 25000, 40000]
    
    # Source configurations
    SOURCES = {
        'savings_gov_pk': {
            'url': 'https://savings.gov.pk',
            'denominations': [100, 200, 750, 1500, 25000, 40000],
            'years': range(2019, 2027),
            'active': True
        },
        'prizeinfo_net': {
            'url': 'https://www.prizeinfo.net',
            'denominations': [100, 200, 750, 1500, 7500, 15000, 25000, 40000],
            'years': range(2010, 2027),
            'active': True
        }
    }
    
    def __init__(self, output_dir: str = "raw_data", max_workers: int = 25):
        """Initialize scraper"""
        self.output_dir = output_dir
        self.max_workers = max_workers
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        self.setup_directories()
        self.setup_logging()
        
        # Statistics
        self.stats = {
            'total_files': 0,
            'downloaded': 0,
            'skipped': 0,
            'failed': 0
        }
        self.lock = threading.Lock()
    
    def setup_directories(self):
        """Create directory structure"""
        dirs = [
            self.output_dir,
            f"{self.output_dir}/savings_gov_pk",
            f"{self.output_dir}/prizeinfo_net",
            f"{self.output_dir}/pakbond_com",
            f"{self.output_dir}/metadata",
            f"{self.output_dir}/logs"
        ]
        for d in dirs:
            os.makedirs(d, exist_ok=True)
    
    def setup_logging(self):
        """Setup logging"""
        log_file = f"{self.output_dir}/logs/scraper_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    # ==================== SAVINGS.GOV.PK ====================
    
    def scrape_savings_gov_pk_listings(self, denomination: int) -> List[Dict]:
        """Scrape draw listings from savings.gov.pk"""
        denom_map = {
            100: "rs-100-prize-bond-draw",
            200: "rs-200-prize-bond-draw",
            750: "rs-750-prize-bond-draw",
            1500: "rs-1500-prize-bond-draw",
            25000: "premium-prize-bond-rs-25000",
            40000: "premium-prize-bond-rs-40000"
        }
        
        if denomination not in denom_map:
            return []
        
        url = f"https://savings.gov.pk/{denom_map[denomination]}"
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            draws = []
            current_year = None
            
            h2_tags = soup.find_all('h2')
            
            for h2 in h2_tags:
                text = h2.get_text(strip=True)
                
                if text.isdigit() and len(text) == 4:
                    current_year = text
                    continue
                
                link = h2.find('a')
                if link and current_year:
                    href = link.get('href', '')
                    if not href or '.txt' not in href.lower():
                        continue
                    
                    if not href.startswith('http'):
                        file_url = 'https://savings.gov.pk' + href if href.startswith('/') else f"https://savings.gov.pk/{href}"
                    else:
                        file_url = href
                    
                    draws.append({
                        'source': 'savings_gov_pk',
                        'denomination': denomination,
                        'date': text,
                        'year': current_year,
                        'url': file_url
                    })
            
            self.logger.info(f"savings.gov.pk: Found {len(draws)} draws for Rs. {denomination}")
            return draws
            
        except Exception as e:
            self.logger.error(f"Error scraping savings.gov.pk Rs. {denomination}: {e}")
            return []
    
    # ==================== PRIZEINFO.NET ====================
    
    def scrape_prizeinfo_net_listings(self, denomination: int) -> List[Dict]:
        """Scrape draw listings from prizeinfo.net"""
        url = f"https://www.prizeinfo.net/results/{denomination}/"
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            draws = []
            
            # Find all draw links (pattern: /results/DENOM/NUMBER/)
            links = soup.find_all('a', href=re.compile(f'/results/{denomination}/\\d+/'))
            
            for link in links:
                href = link.get('href')
                text = link.get_text(strip=True)
                
                # Extract date and draw number from text
                # Example: "Draw #84 - 15 Feb 2025"
                draw_url = f"https://www.prizeinfo.net{href}"
                
                # Try to extract year from text
                year_match = re.search(r'20\d{2}', text)
                year = year_match.group() if year_match else None
                
                draws.append({
                    'source': 'prizeinfo_net',
                    'denomination': denomination,
                    'date': text,
                    'year': year,
                    'url': draw_url
                })
            
            self.logger.info(f"prizeinfo.net: Found {len(draws)} draws for Rs. {denomination}")
            return draws
            
        except Exception as e:
            self.logger.error(f"Error scraping prizeinfo.net Rs. {denomination}: {e}")
            return []
    
    # ==================== DOWNLOAD ====================
    
    def download_file(self, draw: Dict) -> bool:
        """Download a single draw file"""
        try:
            # Create filename
            source = draw['source']
            denom = draw['denomination']
            date = draw['date'].replace('/', '-').replace(' ', '_')[:50]  # Limit length
            
            filename = f"{denom}_{date}.txt"
            filepath = f"{self.output_dir}/{source}/{filename}"
            
            # Skip if exists
            if os.path.exists(filepath):
                with self.lock:
                    self.stats['skipped'] += 1
                return True
            
            # Download
            response = self.session.get(draw['url'], timeout=30)
            response.raise_for_status()
            
            # Save
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            # Save metadata
            metadata = {
                'filename': filename,
                'source': source,
                'denomination': denom,
                'date': draw['date'],
                'year': draw['year'],
                'url': draw['url'],
                'downloaded_at': datetime.now().isoformat()
            }
            
            metadata_file = f"{self.output_dir}/metadata/{filename}.json"
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            with self.lock:
                self.stats['downloaded'] += 1
                print(f"\r[{self.stats['downloaded']}/{self.stats['total_files']}] Downloaded: {filename[:50]}", end="", flush=True)
            
            return True
            
        except Exception as e:
            with self.lock:
                self.stats['failed'] += 1
            self.logger.error(f"Error downloading {draw.get('date', 'unknown')}: {e}")
            return False
    
    # ==================== MAIN SCRAPING ====================
    
    def scrape_all_sources(self, denominations: Optional[List[int]] = None):
        """Scrape all sources in parallel"""
        
        if denominations is None:
            denominations = self.ALL_DENOMINATIONS
        
        print("\n" + "="*80)
        print("🌐 MULTI-SOURCE PRIZE BOND SCRAPER")
        print("="*80)
        print(f"📊 Denominations: {denominations}")
        print(f"⚡ Workers: {self.max_workers}")
        print(f"📅 Target Years: 1998-2026")
        print("="*80)
        
        start_time = time.time()
        
        # Collect all draw listings
        all_draws = []
        
        for denom in denominations:
            print(f"\n🔍 Collecting listings for Rs. {denom}...")
            
            # Source 1: savings.gov.pk
            if denom in self.SOURCES['savings_gov_pk']['denominations']:
                draws = self.scrape_savings_gov_pk_listings(denom)
                all_draws.extend(draws)
                time.sleep(0.5)
            
            # Source 2: prizeinfo.net
            if denom in self.SOURCES['prizeinfo_net']['denominations']:
                draws = self.scrape_prizeinfo_net_listings(denom)
                all_draws.extend(draws)
                time.sleep(0.5)
        
        self.stats['total_files'] = len(all_draws)
        
        print(f"\n\n📋 Total draws found: {len(all_draws)}")
        print(f"🚀 Starting parallel download with {self.max_workers} workers...\n")
        
        # Download in parallel
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self.download_file, draw) for draw in all_draws]
            
            for future in as_completed(futures):
                future.result()
        
        elapsed = time.time() - start_time
        
        print(f"\n\n{'='*80}")
        print("✅ SCRAPING COMPLETED!")
        print("="*80)
        print(f"⏱️  Time: {elapsed:.1f}s ({elapsed/60:.1f} minutes)")
        print(f"📥 Downloaded: {self.stats['downloaded']}")
        print(f"⏭️  Skipped (exists): {self.stats['skipped']}")
        print(f"❌ Failed: {self.stats['failed']}")
        print(f"📂 Data saved to: {self.output_dir}/")
        print("="*80)
        
        # Save summary
        summary = {
            'timestamp': datetime.now().isoformat(),
            'duration_seconds': elapsed,
            'statistics': self.stats,
            'sources_scraped': list(self.SOURCES.keys())
        }
        
        summary_file = f"{self.output_dir}/scraping_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"\n📄 Summary saved to: {summary_file}\n")


def main():
    """Main function"""
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║               MULTI-SOURCE PRIZE BOND DATA SCRAPER                           ║
║                    Fetches Raw Data (1998-2026)                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
""")
    
    # Configuration
    print("\n⚙️  Configuration:")
    workers = input("Number of parallel workers (default=25): ").strip()
    max_workers = int(workers) if workers.isdigit() else 25
    
    # Select denominations
    print("\n📊 Select Denominations:")
    print("  1. Rs. 100")
    print("  2. Rs. 200")
    print("  3. Rs. 750")
    print("  4. Rs. 1500")
    print("  5. Rs. 7500 (Discontinued - Historical)")
    print("  6. Rs. 15000 (Discontinued - Historical)")
    print("  7. Rs. 25000 Premium")
    print("  8. Rs. 40000 Premium")
    print("  9. ALL")
    
    choice = input("\nEnter choice (comma-separated or 'all'): ").strip().lower()
    
    if choice == 'all' or choice == '9':
        denominations = [100, 200, 750, 1500, 7500, 15000, 25000, 40000]
    else:
        denom_map = [100, 200, 750, 1500, 7500, 15000, 25000, 40000]
        try:
            indices = [int(x.strip()) for x in choice.split(',')]
            denominations = [denom_map[i-1] for i in indices if 1 <= i <= 8]
        except:
            print("Invalid input, using all denominations")
            denominations = [100, 200, 750, 1500, 7500, 15000, 25000, 40000]
    
    print(f"\n✓ Selected: {', '.join(f'Rs. {d}' for d in denominations)}")
    
    # Confirm
    confirm = input("\n🚀 Start scraping? (y/n): ").strip().lower()
    
    if confirm == 'y':
        scraper = MultiSourceScraper(
            output_dir="raw_data",
            max_workers=max_workers
        )
        
        scraper.scrape_all_sources(denominations=denominations)
    else:
        print("❌ Cancelled")


if __name__ == "__main__":
    main()