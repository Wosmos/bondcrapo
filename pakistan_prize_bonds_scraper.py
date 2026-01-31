"""
Pakistan Prize Bonds Web Scraper
Scrapes all prize bond draw results from savings.gov.pk

This scraper collects:
- All prize bond denominations (100, 200, 750, 1500, 25000, 40000)
- All historical draw results
- Draw schedules
- Prize information
"""

import requests
from bs4 import BeautifulSoup
import json
import csv
import os
from datetime import datetime
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin

class PakistanPrizeBondScraper:
    """Scraper for Pakistan National Savings prize bonds data"""
    
    BASE_URL = "https://savings.gov.pk"
    
    # Prize bond denominations and their URLs
    BOND_DENOMINATIONS = {
        100: "/rs-100-prize-bond-draw",
        200: "/rs-200-prize-bond-draw",
        750: "/rs-750-prize-bond-draw",
        1500: "/rs-1500-prize-bond-draw",
        25000: "/premium-prize-bond-rs-25000",
        40000: "/premium-prize-bond-rs-40000"
    }
    
    def __init__(self, output_dir: str = "prize_bonds_data"):
        """
        Initialize the scraper
        
        Args:
            output_dir: Directory to save scraped data
        """
        self.output_dir = output_dir
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        # Create output directories
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(f"{output_dir}/raw_files", exist_ok=True)
        os.makedirs(f"{output_dir}/json", exist_ok=True)
        os.makedirs(f"{output_dir}/csv", exist_ok=True)
    
    def get_page(self, url: str, max_retries: int = 3) -> Optional[BeautifulSoup]:
        """
        Fetch and parse a webpage
        
        Args:
            url: URL to fetch
            max_retries: Maximum number of retry attempts
            
        Returns:
            BeautifulSoup object or None if failed
        """
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                return BeautifulSoup(response.content, 'html.parser')
            except Exception as e:
                print(f"Error fetching {url} (attempt {attempt + 1}/{max_retries}): {e}")
                time.sleep(2 ** attempt)  # Exponential backoff
        return None
    
    def scrape_draw_listings(self, denomination: int) -> List[Dict]:
        """
        Scrape all draw listings for a specific denomination
        
        Args:
            denomination: Prize bond denomination (100, 200, etc.)
            
        Returns:
            List of draw information dictionaries
        """
        url = urljoin(self.BASE_URL, self.BOND_DENOMINATIONS[denomination])
        print(f"\n{'='*60}")
        print(f"Scraping Rs. {denomination} Prize Bond Draws")
        print(f"URL: {url}")
        print(f"{'='*60}")
        
        soup = self.get_page(url)
        if not soup:
            print(f"Failed to fetch page for Rs. {denomination}")
            return []
        
        draws = []
        
        # Find all year sections
        year_headings = soup.find_all('h2')
        
        for year_heading in year_headings:
            year_text = year_heading.get_text(strip=True)
            
            # Check if it's a year
            if not year_text.isdigit() or len(year_text) != 4:
                continue
            
            year = year_text
            print(f"\nProcessing Year: {year}")
            
            # Find all links after this heading until next h2
            current = year_heading.find_next_sibling()
            
            while current and current.name != 'h2':
                if current.name == 'h2' and current.find('a'):
                    link_tag = current.find('a')
                    draw_date = link_tag.get_text(strip=True)
                    draw_url = link_tag.get('href', '')
                    
                    if draw_url:
                        draw_info = {
                            'denomination': denomination,
                            'draw_date': draw_date,
                            'year': year,
                            'file_url': urljoin(self.BASE_URL, draw_url),
                            'file_type': self._get_file_type(draw_url)
                        }
                        draws.append(draw_info)
                        print(f"  Found: {draw_date} - {draw_info['file_type']}")
                
                current = current.find_next_sibling()
        
        print(f"\nTotal draws found for Rs. {denomination}: {len(draws)}")
        return draws
    
    def _get_file_type(self, url: str) -> str:
        """Determine file type from URL"""
        if url.endswith('.txt'):
            return 'txt'
        elif url.endswith('.pdf'):
            return 'pdf'
        elif url.endswith('.docx') or url.endswith('.doc'):
            return 'docx'
        return 'unknown'
    
    def download_draw_file(self, draw_info: Dict) -> Optional[str]:
        """
        Download a draw result file
        
        Args:
            draw_info: Dictionary containing draw information
            
        Returns:
            Local file path or None if failed
        """
        try:
            response = self.session.get(draw_info['file_url'], timeout=30)
            response.raise_for_status()
            
            # Create filename
            safe_date = draw_info['draw_date'].replace('/', '-')
            filename = f"{draw_info['denomination']}_{safe_date}.{draw_info['file_type']}"
            filepath = os.path.join(self.output_dir, 'raw_files', filename)
            
            # Save file
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            print(f"  Downloaded: {filename}")
            return filepath
            
        except Exception as e:
            print(f"  Error downloading {draw_info['file_url']}: {e}")
            return None
    
    def parse_txt_results(self, filepath: str) -> Optional[Dict]:
        """
        Parse text file containing draw results
        
        Args:
            filepath: Path to the text file
            
        Returns:
            Dictionary containing parsed results
        """
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            results = {
                'first_prize': [],
                'second_prizes': [],
                'third_prizes': [],
                'raw_content': content
            }
            
            # Extract prize numbers using regex patterns
            # This will need to be customized based on actual file format
            
            return results
        except Exception as e:
            print(f"Error parsing {filepath}: {e}")
            return None
    
    def scrape_all_bonds(self) -> Dict:
        """
        Scrape all prize bond denominations
        
        Returns:
            Dictionary containing all scraped data
        """
        all_data = {}
        
        for denomination in self.BOND_DENOMINATIONS.keys():
            draws = self.scrape_draw_listings(denomination)
            all_data[denomination] = draws
            
            # Save denomination data to JSON
            json_path = os.path.join(self.output_dir, 'json', f'draws_{denomination}.json')
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(draws, f, indent=2, ensure_ascii=False)
            
            # Save to CSV
            csv_path = os.path.join(self.output_dir, 'csv', f'draws_{denomination}.csv')
            if draws:
                with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=draws[0].keys())
                    writer.writeheader()
                    writer.writerows(draws)
            
            # Be nice to the server
            time.sleep(1)
        
        # Save combined data
        combined_path = os.path.join(self.output_dir, 'all_draws_metadata.json')
        with open(combined_path, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, indent=2, ensure_ascii=False)
        
        return all_data
    
    def download_all_results(self, metadata: Dict, limit: Optional[int] = None):
        """
        Download all draw result files
        
        Args:
            metadata: Dictionary containing draw metadata
            limit: Optional limit on number of files to download per denomination
        """
        print("\n" + "="*60)
        print("DOWNLOADING DRAW RESULT FILES")
        print("="*60)
        
        total_downloaded = 0
        total_failed = 0
        
        for denomination, draws in metadata.items():
            print(f"\n--- Downloading Rs. {denomination} results ---")
            
            draws_to_download = draws[:limit] if limit else draws
            
            for i, draw in enumerate(draws_to_download, 1):
                print(f"\n[{i}/{len(draws_to_download)}]", end=" ")
                filepath = self.download_draw_file(draw)
                
                if filepath:
                    total_downloaded += 1
                else:
                    total_failed += 1
                
                # Rate limiting
                time.sleep(0.5)
        
        print("\n" + "="*60)
        print(f"Download Summary:")
        print(f"  Successfully downloaded: {total_downloaded}")
        print(f"  Failed: {total_failed}")
        print("="*60)
    
    def scrape_draw_schedule(self) -> List[Dict]:
        """
        Scrape the current prize bond draw schedule
        
        Returns:
            List of scheduled draws
        """
        url = urljoin(self.BASE_URL, "/prize-bonds/")
        print(f"\nScraping draw schedule from: {url}")
        
        soup = self.get_page(url)
        if not soup:
            return []
        
        schedule = []
        
        # Look for schedule image or table
        # The actual implementation depends on how the schedule is presented
        # on the website
        
        return schedule
    
    def generate_report(self, metadata: Dict):
        """
        Generate a summary report of scraped data
        
        Args:
            metadata: Dictionary containing all scraped metadata
        """
        report_path = os.path.join(self.output_dir, 'scraping_report.txt')
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("="*60 + "\n")
            f.write("PAKISTAN PRIZE BONDS SCRAPING REPORT\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("="*60 + "\n\n")
            
            for denomination, draws in metadata.items():
                f.write(f"\nRs. {denomination} Prize Bonds:\n")
                f.write(f"  Total draws found: {len(draws)}\n")
                
                if draws:
                    years = set(d['year'] for d in draws)
                    f.write(f"  Years covered: {', '.join(sorted(years, reverse=True))}\n")
                    
                    file_types = {}
                    for draw in draws:
                        ft = draw['file_type']
                        file_types[ft] = file_types.get(ft, 0) + 1
                    
                    f.write(f"  File types: {file_types}\n")
            
            f.write("\n" + "="*60 + "\n")
            f.write(f"Data saved to: {self.output_dir}/\n")
            f.write("="*60 + "\n")
        
        print(f"\nReport saved to: {report_path}")


def main():
    """Main execution function"""
    print("="*60)
    print("PAKISTAN PRIZE BONDS WEB SCRAPER")
    print("Scraping data from savings.gov.pk")
    print("="*60)
    
    # Initialize scraper
    scraper = PakistanPrizeBondScraper(output_dir="prize_bonds_data")
    
    # Scrape all bond denominations metadata
    print("\n[STEP 1] Scraping draw listings...")
    metadata = scraper.scrape_all_bonds()
    
    # Generate report
    print("\n[STEP 2] Generating report...")
    scraper.generate_report(metadata)
    
    # Optional: Download actual draw files
    # Uncomment the line below to download files (can be large)
    download = input("\nDo you want to download all draw result files? (y/n): ").lower()
    if download == 'y':
        limit = input("Enter limit per denomination (or press Enter for all): ").strip()
        limit = int(limit) if limit.isdigit() else None
        
        print("\n[STEP 3] Downloading draw result files...")
        scraper.download_all_results(metadata, limit=limit)
    
    print("\n✅ Scraping completed successfully!")
    print(f"📁 Data saved to: prize_bonds_data/")
    print("\nFolder structure:")
    print("  - json/          : Draw metadata in JSON format")
    print("  - csv/           : Draw metadata in CSV format")
    print("  - raw_files/     : Downloaded draw result files")
    print("  - *.json         : Combined metadata")
    print("  - *.txt          : Summary reports")


if __name__ == "__main__":
    main()