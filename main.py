"""
Pakistan Prize Bonds Advanced Scraper
Powerful, optimized scraper with full user control

Features:
- Multi-threaded downloading
- Resume capability
- Detailed progress tracking
- Multiple output formats
- Flexible filtering options
- Data validation
"""

import requests
from bs4 import BeautifulSoup
import json
import csv
import os
import time
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
import logging

class PrizeBondScraper:
    """Advanced Pakistan Prize Bonds Scraper"""
    
    BASE_URL = "https://savings.gov.pk"
    
    DENOMINATIONS = {
        100: "rs-100-prize-bond-draw",
        200: "rs-200-prize-bond-draw",
        750: "rs-750-prize-bond-draw",
        1500: "rs-1500-prize-bond-draw",
        25000: "premium-prize-bond-rs-25000",
        40000: "premium-prize-bond-rs-40000"
    }
    
    def __init__(self, output_dir: str = "prize_bonds_data", verbose: bool = True):
        """Initialize scraper"""
        self.output_dir = output_dir
        self.verbose = verbose
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        # Create directory structure
        self.create_directories()
        
        # Setup logging
        self.setup_logging()
        
        # Statistics
        self.stats = {
            'total_draws': 0,
            'total_downloaded': 0,
            'total_failed': 0,
            'start_time': None,
            'end_time': None
        }
    
    def create_directories(self):
        """Create output directory structure"""
        dirs = [
            self.output_dir,
            f"{self.output_dir}/json",
            f"{self.output_dir}/csv",
            f"{self.output_dir}/downloads",
            f"{self.output_dir}/logs",
            f"{self.output_dir}/cache"
        ]
        for d in dirs:
            os.makedirs(d, exist_ok=True)
    
    def setup_logging(self):
        """Setup logging"""
        log_file = f"{self.output_dir}/logs/scraper_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        logging.basicConfig(
            level=logging.INFO if self.verbose else logging.WARNING,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string to datetime object"""
        # Try different date formats
        formats = [
            '%d-%m-%Y',
            '%d/%m/%Y',
            '%Y-%m-%d',
            '%d-%m-%y'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str.split('(')[0].strip(), fmt)
            except:
                continue
        return None
    
    def extract_draws_from_page(self, denomination: int) -> List[Dict]:
        """Extract all draw information from a denomination page"""
        url = f"{self.BASE_URL}/{self.DENOMINATIONS[denomination]}"
        self.logger.info(f"Scraping {url}")
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            draws = []
            current_year = None
            
            # Find all h2 tags
            h2_tags = soup.find_all('h2')
            
            for h2 in h2_tags:
                text = h2.get_text(strip=True)
                
                # Check if it's a year header
                if text.isdigit() and len(text) == 4:
                    current_year = text
                    continue
                
                # Check if it has a link (draw entry)
                link = h2.find('a')
                if link and current_year:
                    href = link.get('href', '')
                    if not href:
                        continue
                    
                    # Make absolute URL
                    if not href.startswith('http'):
                        file_url = self.BASE_URL + href if href.startswith('/') else f"{self.BASE_URL}/{href}"
                    else:
                        file_url = href
                    
                    # Extract file type
                    file_type = 'unknown'
                    if '.txt' in file_url.lower():
                        file_type = 'txt'
                    elif '.pdf' in file_url.lower():
                        file_type = 'pdf'
                    elif '.docx' in file_url.lower() or '.doc' in file_url.lower():
                        file_type = 'docx'
                    
                    # Parse the date from text
                    date_str = text
                    parsed_date = self.parse_date(date_str)
                    
                    draw = {
                        'denomination': denomination,
                        'date_string': date_str,
                        'date_parsed': parsed_date.strftime('%Y-%m-%d') if parsed_date else None,
                        'year': current_year,
                        'file_url': file_url,
                        'file_type': file_type,
                        'downloaded': False,
                        'local_path': None
                    }
                    
                    draws.append(draw)
                    self.logger.debug(f"Found: {date_str} ({file_type})")
            
            self.logger.info(f"Found {len(draws)} draws for Rs. {denomination}")
            return draws
            
        except Exception as e:
            self.logger.error(f"Error scraping Rs. {denomination}: {e}")
            return []
    
    def scrape_metadata(self, denominations: Optional[List[int]] = None,
                       years: Optional[List[str]] = None) -> Dict:
        """
        Scrape metadata for specified denominations and years
        
        Args:
            denominations: List of denominations to scrape (None = all)
            years: List of years to filter (None = all)
        
        Returns:
            Dictionary with all scraped metadata
        """
        self.stats['start_time'] = datetime.now()
        
        if denominations is None:
            denominations = list(self.DENOMINATIONS.keys())
        
        all_data = {}
        
        print("\n" + "="*80)
        print("📊 SCRAPING PRIZE BOND METADATA")
        print("="*80)
        
        for denom in denominations:
            if denom not in self.DENOMINATIONS:
                self.logger.warning(f"Invalid denomination: {denom}, skipping")
                continue
            
            print(f"\n🎯 Rs. {denom} Prize Bonds")
            print("-"*80)
            
            draws = self.extract_draws_from_page(denom)
            
            # Filter by years if specified
            if years:
                draws = [d for d in draws if d['year'] in years]
                print(f"   Filtered to years: {', '.join(years)}")
            
            all_data[denom] = draws
            self.stats['total_draws'] += len(draws)
            
            print(f"   ✓ Found {len(draws)} draws")
            
            # Save individual denomination data
            self.save_denomination_data(denom, draws)
            
            time.sleep(1)  # Rate limiting
        
        # Save combined data
        self.save_combined_data(all_data)
        
        self.stats['end_time'] = datetime.now()
        
        return all_data
    
    def save_denomination_data(self, denomination: int, draws: List[Dict]):
        """Save data for a single denomination"""
        # JSON
        json_file = f"{self.output_dir}/json/draws_{denomination}.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(draws, f, indent=2, ensure_ascii=False)
        
        # CSV
        if draws:
            csv_file = f"{self.output_dir}/csv/draws_{denomination}.csv"
            with open(csv_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=draws[0].keys())
                writer.writeheader()
                writer.writerows(draws)
    
    def save_combined_data(self, all_data: Dict):
        """Save combined data across all denominations"""
        json_file = f"{self.output_dir}/all_draws.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"Saved combined data to {json_file}")
    
    def download_file(self, draw: Dict) -> Tuple[bool, str]:
        """
        Download a single draw file
        
        Returns:
            (success, message)
        """
        try:
            filename = f"{draw['denomination']}_{draw['date_string'].replace('/', '-').replace(' ', '_')}.{draw['file_type']}"
            filepath = f"{self.output_dir}/downloads/{filename}"
            
            # Check if already exists
            if os.path.exists(filepath):
                return True, f"Already exists: {filename}"
            
            # Download
            response = self.session.get(draw['file_url'], timeout=30)
            response.raise_for_status()
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            draw['downloaded'] = True
            draw['local_path'] = filepath
            
            return True, f"Downloaded: {filename}"
            
        except Exception as e:
            return False, f"Failed: {draw['date_string']} - {str(e)[:50]}"
    
    def download_files_sequential(self, all_data: Dict, 
                                  denominations: Optional[List[int]] = None,
                                  limit_per_denom: Optional[int] = None) -> Dict:
        """Download files sequentially"""
        print("\n" + "="*80)
        print("📥 DOWNLOADING FILES (Sequential)")
        print("="*80)
        
        for denom, draws in all_data.items():
            if denominations and denom not in denominations:
                continue
            
            if not draws:
                continue
            
            print(f"\n🎯 Rs. {denom} Prize Bonds ({len(draws)} files)")
            
            # Apply limit
            draws_to_download = draws[:limit_per_denom] if limit_per_denom else draws
            
            for i, draw in enumerate(draws_to_download, 1):
                success, msg = self.download_file(draw)
                
                if success:
                    self.stats['total_downloaded'] += 1
                    print(f"   [{i}/{len(draws_to_download)}] ✓ {msg}")
                else:
                    self.stats['total_failed'] += 1
                    print(f"   [{i}/{len(draws_to_download)}] ✗ {msg}")
                
                time.sleep(0.5)  # Rate limiting
        
        return all_data
    
    def download_files_parallel(self, all_data: Dict,
                               denominations: Optional[List[int]] = None,
                               limit_per_denom: Optional[int] = None,
                               max_workers: int = 5) -> Dict:
        """Download files in parallel"""
        print("\n" + "="*80)
        print(f"📥 DOWNLOADING FILES (Parallel - {max_workers} workers)")
        print("="*80)
        
        all_draws = []
        for denom, draws in all_data.items():
            if denominations and denom not in denominations:
                continue
            
            draws_to_add = draws[:limit_per_denom] if limit_per_denom else draws
            all_draws.extend(draws_to_add)
        
        print(f"\n📊 Total files to download: {len(all_draws)}\n")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_draw = {executor.submit(self.download_file, draw): draw 
                            for draw in all_draws}
            
            for i, future in enumerate(as_completed(future_to_draw), 1):
                success, msg = future.result()
                
                if success:
                    self.stats['total_downloaded'] += 1
                    print(f"[{i}/{len(all_draws)}] ✓ {msg}")
                else:
                    self.stats['total_failed'] += 1
                    print(f"[{i}/{len(all_draws)}] ✗ {msg}")
        
        return all_data
    
    def generate_report(self, all_data: Dict):
        """Generate comprehensive report"""
        report_file = f"{self.output_dir}/scraping_report.txt"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("="*80 + "\n")
            f.write("PAKISTAN PRIZE BONDS - SCRAPING REPORT\n")
            f.write("="*80 + "\n\n")
            
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            
            if self.stats['start_time'] and self.stats['end_time']:
                duration = self.stats['end_time'] - self.stats['start_time']
                f.write(f"Duration: {duration}\n")
            
            f.write(f"\nTotal Draws Found: {self.stats['total_draws']}\n")
            f.write(f"Files Downloaded: {self.stats['total_downloaded']}\n")
            f.write(f"Failed Downloads: {self.stats['total_failed']}\n")
            
            f.write("\n" + "="*80 + "\n")
            f.write("BREAKDOWN BY DENOMINATION\n")
            f.write("="*80 + "\n\n")
            
            for denom, draws in sorted(all_data.items()):
                f.write(f"Rs. {denom} Prize Bonds:\n")
                f.write(f"  Total Draws: {len(draws)}\n")
                
                if draws:
                    years = sorted(set(d['year'] for d in draws if d['year']), reverse=True)
                    f.write(f"  Years: {', '.join(years)}\n")
                    
                    file_types = {}
                    for draw in draws:
                        ft = draw['file_type']
                        file_types[ft] = file_types.get(ft, 0) + 1
                    f.write(f"  File Types: {file_types}\n")
                    
                    downloaded = sum(1 for d in draws if d.get('downloaded', False))
                    f.write(f"  Downloaded: {downloaded}\n")
                
                f.write("\n")
            
            f.write("="*80 + "\n")
            f.write(f"Output Directory: {self.output_dir}\n")
            f.write("="*80 + "\n")
        
        print(f"\n📄 Report saved: {report_file}")
        return report_file
    
    def interactive_mode(self):
        """Interactive mode with user prompts"""
        print("\n" + "="*80)
        print("🎯 PAKISTAN PRIZE BONDS SCRAPER - INTERACTIVE MODE")
        print("="*80)
        
        # Select denominations
        print("\n📊 Available Denominations:")
        for i, denom in enumerate(self.DENOMINATIONS.keys(), 1):
            print(f"  {i}. Rs. {denom}")
        print(f"  {len(self.DENOMINATIONS)+1}. All")
        
        choice = input("\nSelect denomination (comma-separated numbers or 'all'): ").strip().lower()
        
        if choice == 'all' or str(len(self.DENOMINATIONS)+1) in choice:
            selected_denoms = list(self.DENOMINATIONS.keys())
        else:
            try:
                indices = [int(x.strip()) for x in choice.split(',')]
                denoms_list = list(self.DENOMINATIONS.keys())
                selected_denoms = [denoms_list[i-1] for i in indices if 1 <= i <= len(denoms_list)]
            except:
                print("Invalid input, using all denominations")
                selected_denoms = list(self.DENOMINATIONS.keys())
        
        print(f"\n✓ Selected: {', '.join(f'Rs. {d}' for d in selected_denoms)}")
        
        # Year filter
        year_filter = input("\nFilter by years? (e.g., 2024,2025 or press Enter for all): ").strip()
        years = [y.strip() for y in year_filter.split(',') if y.strip()] if year_filter else None
        
        # Scrape metadata
        print("\n🔍 Scraping metadata...")
        all_data = self.scrape_metadata(denominations=selected_denoms, years=years)
        
        # Download files?
        download = input("\n💾 Download files? (y/n): ").strip().lower()
        
        if download == 'y':
            # Limit per denomination
            limit = input("Limit per denomination (press Enter for all): ").strip()
            limit_per_denom = int(limit) if limit.isdigit() else None
            
            # Parallel or sequential
            method = input("Download method (p=parallel, s=sequential): ").strip().lower()
            
            if method == 'p':
                workers = input("Number of parallel workers (default=5): ").strip()
                max_workers = int(workers) if workers.isdigit() else 5
                self.download_files_parallel(all_data, limit_per_denom=limit_per_denom, 
                                           max_workers=max_workers)
            else:
                self.download_files_sequential(all_data, limit_per_denom=limit_per_denom)
        
        # Generate report
        self.generate_report(all_data)
        
        print("\n🎉 ALL DONE!")
        print(f"📂 Check '{self.output_dir}' folder for results\n")


def main():
    """Main function with CLI support"""
    parser = argparse.ArgumentParser(
        description='Pakistan Prize Bonds Advanced Scraper',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive mode
  python %(prog)s

  # Scrape all denominations
  python %(prog)s --scrape-all

  # Scrape specific denominations
  python %(prog)s --denominations 100 200 750

  # Scrape and download (parallel)
  python %(prog)s --scrape-all --download --parallel --workers 10

  # Scrape specific years
  python %(prog)s --scrape-all --years 2024 2025

  # Download only, limit 5 per denomination
  python %(prog)s --scrape-all --download --limit 5
        """
    )
    
    parser.add_argument('--output-dir', default='prize_bonds_data',
                       help='Output directory (default: prize_bonds_data)')
    parser.add_argument('--scrape-all', action='store_true',
                       help='Scrape all denominations')
    parser.add_argument('--denominations', type=int, nargs='+',
                       help='Specific denominations to scrape')
    parser.add_argument('--years', nargs='+',
                       help='Filter by specific years')
    parser.add_argument('--download', action='store_true',
                       help='Download files after scraping')
    parser.add_argument('--parallel', action='store_true',
                       help='Use parallel downloading')
    parser.add_argument('--workers', type=int, default=5,
                       help='Number of parallel workers (default: 5)')
    parser.add_argument('--limit', type=int,
                       help='Limit files per denomination')
    parser.add_argument('--verbose', action='store_true',
                       help='Verbose output')
    
    args = parser.parse_args()
    
    # Create scraper
    scraper = PrizeBondScraper(output_dir=args.output_dir, verbose=args.verbose)
    
    # If no args, run interactive mode
    if not any([args.scrape_all, args.denominations]):
        scraper.interactive_mode()
        return
    
    # Determine denominations
    if args.scrape_all:
        denominations = None
    elif args.denominations:
        denominations = args.denominations
    else:
        denominations = None
    
    # Scrape metadata
    print("\n🔍 Scraping metadata...")
    all_data = scraper.scrape_metadata(denominations=denominations, years=args.years)
    
    # Download if requested
    if args.download:
        if args.parallel:
            scraper.download_files_parallel(all_data, limit_per_denom=args.limit,
                                          max_workers=args.workers)
        else:
            scraper.download_files_sequential(all_data, limit_per_denom=args.limit)
    
    # Generate report
    scraper.generate_report(all_data)
    
    print("\n🎉 COMPLETED!")
    print(f"📂 Results in: {args.output_dir}\n")


if __name__ == "__main__":
    main()