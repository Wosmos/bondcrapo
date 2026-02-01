"""
Pakistan Prize Bonds Complete Scraper & Parser
Scrapes draw listings, downloads TXT files, and extracts all winning numbers

Features:
- Downloads all draw TXT files
- Parses 1st, 2nd, and 3rd prize winners
- Maps prize amounts automatically
- Outputs structured CSV ready for database
- Handles all denominations
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
import logging

class CompletePrizeBondScraper:
    """Complete scraper with number extraction"""
    
    BASE_URL = "https://savings.gov.pk"
    
    # Prize structure from the official table
    PRIZE_STRUCTURE = {
        100: {
            '1st': {'amount': 700000, 'count': 1},
            '2nd': {'amount': 200000, 'count': 3},
            '3rd': {'amount': 1000, 'count': 1199}
        },
        200: {
            '1st': {'amount': 750000, 'count': 1},
            '2nd': {'amount': 250000, 'count': 5},
            '3rd': {'amount': 1250, 'count': 2394}
        },
        750: {
            '1st': {'amount': 1500000, 'count': 1},
            '2nd': {'amount': 500000, 'count': 3},
            '3rd': {'amount': 9300, 'count': 1696}
        },
        1500: {
            '1st': {'amount': 3000000, 'count': 1},
            '2nd': {'amount': 1000000, 'count': 3},
            '3rd': {'amount': 18500, 'count': 1696}
        },
        7500: {
            '1st': {'amount': 15000000, 'count': 1},
            '2nd': {'amount': 5000000, 'count': 3},
            '3rd': {'amount': 93000, 'count': 1696}
        },
        15000: {
            '1st': {'amount': 30000000, 'count': 1},
            '2nd': {'amount': 10000000, 'count': 3},
            '3rd': {'amount': 185000, 'count': 1696}
        },
        25000: {
            '1st': {'amount': 50000000, 'count': 1},
            '2nd': {'amount': 15000000, 'count': 3},
            '3rd': {'amount': 312000, 'count': 1696}
        },
        40000: {
            '1st': {'amount': 75000000, 'count': 1},
            '2nd': {'amount': 25000000, 'count': 3},
            '3rd': {'amount': 500000, 'count': 1696}
        }
    }
    
    DENOMINATIONS = {
        100: "rs-100-prize-bond-draw",
        200: "rs-200-prize-bond-draw",
        750: "rs-750-prize-bond-draw",
        1500: "rs-1500-prize-bond-draw",
        7500: "rs-7500-prize-bond-draw",
        15000: "rs-15000-prize-bond-draw",
        25000: "premium-prize-bond-rs-25000",
        40000: "premium-prize-bond-rs-40000"
    }
    
    def __init__(self, output_dir: str = "prize_bonds_complete"):
        """Initialize scraper"""
        self.output_dir = output_dir
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        self.setup_directories()
        self.setup_logging()
        
        self.all_winners = []  # Store all winners across all draws
    
    def setup_directories(self):
        """Create directory structure"""
        dirs = [
            self.output_dir,
            f"{self.output_dir}/raw_txt",
            f"{self.output_dir}/csv",
            f"{self.output_dir}/json",
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
    
    def scrape_draw_listings(self, denomination: int) -> List[Dict]:
        """Scrape all draw listings for a denomination"""
        url = f"{self.BASE_URL}/{self.DENOMINATIONS[denomination]}"
        self.logger.info(f"Scraping {url}")
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            draws = []
            current_year = None
            
            h2_tags = soup.find_all('h2')
            
            for h2 in h2_tags:
                text = h2.get_text(strip=True)
                
                # Check if it's a year
                if text.isdigit() and len(text) == 4:
                    current_year = text
                    continue
                
                # Check for draw link
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
                    
                    # Only process TXT files for now (most reliable)
                    if '.txt' not in file_url.lower():
                        continue
                    
                    draw = {
                        'denomination': denomination,
                        'date_string': text,
                        'year': current_year,
                        'file_url': file_url
                    }
                    
                    draws.append(draw)
            
            self.logger.info(f"Found {len(draws)} TXT draws for Rs. {denomination}")
            return draws
            
        except Exception as e:
            self.logger.error(f"Error scraping Rs. {denomination}: {e}")
            return []
    
    def download_txt_file(self, draw: Dict) -> Optional[str]:
        """Download a TXT file"""
        try:
            filename = f"{draw['denomination']}_{draw['date_string'].replace('/', '-').replace(' ', '_')}.txt"
            filepath = f"{self.output_dir}/raw_txt/{filename}"
            
            # Skip if exists
            if os.path.exists(filepath):
                self.logger.info(f"File exists: {filename}")
                return filepath
            
            response = self.session.get(draw['file_url'], timeout=30)
            response.raise_for_status()
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            self.logger.info(f"Downloaded: {filename}")
            time.sleep(0.5)  # Rate limiting
            
            return filepath
            
        except Exception as e:
            self.logger.error(f"Error downloading {draw['file_url']}: {e}")
            return None
    
    def parse_txt_file(self, filepath: str, draw: Dict) -> Dict:
        """
        Parse TXT file to extract all winning numbers
        
        The structure is:
        - 1st Prize: First number mentioned (usually at top)
        - 2nd Prize: Next 3-5 numbers (depending on denomination)
        - 3rd Prize: ALL remaining numbers in the file
        """
        try:
            # Try different encodings
            content = None
            for encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
                try:
                    with open(filepath, 'r', encoding=encoding) as f:
                        content = f.read()
                    break
                except:
                    continue
            
            if not content:
                self.logger.error(f"Could not read {filepath}")
                return None
            
            denomination = draw['denomination']
            
            # Extract all 6-digit numbers (prize bond format)
            all_numbers = re.findall(r'\b\d{6}\b', content)
            
            if not all_numbers:
                self.logger.warning(f"No numbers found in {filepath}")
                return None
            
            # Remove duplicates while preserving order
            seen = set()
            unique_numbers = []
            for num in all_numbers:
                if num not in seen:
                    seen.add(num)
                    unique_numbers.append(num)
            
            # Get expected counts from prize structure
            expected_2nd = self.PRIZE_STRUCTURE[denomination]['2nd']['count']
            
            # Parse based on position
            first_prize = unique_numbers[0] if len(unique_numbers) > 0 else None
            second_prizes = unique_numbers[1:1+expected_2nd] if len(unique_numbers) > expected_2nd else []
            third_prizes = unique_numbers[1+expected_2nd:] if len(unique_numbers) > (1+expected_2nd) else []
            
            result = {
                'denomination': denomination,
                'date': draw['date_string'],
                'year': draw['year'],
                'first_prize': first_prize,
                'second_prizes': second_prizes,
                'third_prizes': third_prizes,
                'total_numbers': len(unique_numbers),
                'file_path': filepath
            }
            
            self.logger.info(f"Parsed {filepath}: 1st={first_prize}, 2nd={len(second_prizes)}, 3rd={len(third_prizes)}")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error parsing {filepath}: {e}")
            return None
    
    def create_winners_records(self, parsed_data: Dict) -> List[Dict]:
        """
        Create individual winner records with prize info
        Each record represents one winning bond number
        """
        if not parsed_data:
            return []
        
        denomination = parsed_data['denomination']
        date = parsed_data['date']
        year = parsed_data['year']
        
        winners = []
        
        # 1st Prize
        if parsed_data['first_prize']:
            winners.append({
                'denomination': denomination,
                'draw_date': date,
                'draw_year': year,
                'bond_number': parsed_data['first_prize'],
                'prize_position': '1st',
                'prize_amount': self.PRIZE_STRUCTURE[denomination]['1st']['amount']
            })
        
        # 2nd Prizes
        for num in parsed_data['second_prizes']:
            winners.append({
                'denomination': denomination,
                'draw_date': date,
                'draw_year': year,
                'bond_number': num,
                'prize_position': '2nd',
                'prize_amount': self.PRIZE_STRUCTURE[denomination]['2nd']['amount']
            })
        
        # 3rd Prizes
        for num in parsed_data['third_prizes']:
            winners.append({
                'denomination': denomination,
                'draw_date': date,
                'draw_year': year,
                'bond_number': num,
                'prize_position': '3rd',
                'prize_amount': self.PRIZE_STRUCTURE[denomination]['3rd']['amount']
            })
        
        return winners
    
    def scrape_and_parse_denomination(self, denomination: int, 
                                     download_limit: Optional[int] = None) -> List[Dict]:
        """Complete scraping and parsing for one denomination"""
        print(f"\n{'='*80}")
        print(f"🎯 Processing Rs. {denomination} Prize Bonds")
        print(f"{'='*80}")
        
        # Step 1: Scrape listings
        draws = self.scrape_draw_listings(denomination)
        
        if not draws:
            print(f"❌ No draws found for Rs. {denomination}")
            return []
        
        print(f"📋 Found {len(draws)} draws")
        
        # Apply limit if specified
        if download_limit:
            draws = draws[:download_limit]
            print(f"⚡ Limited to {len(draws)} draws")
        
        all_winners = []
        
        # Step 2: Download and parse each draw
        for i, draw in enumerate(draws, 1):
            print(f"\n[{i}/{len(draws)}] {draw['date_string']}")
            
            # Download
            filepath = self.download_txt_file(draw)
            if not filepath:
                print(f"  ❌ Download failed")
                continue
            
            # Parse
            parsed = self.parse_txt_file(filepath, draw)
            if not parsed:
                print(f"  ❌ Parse failed")
                continue
            
            # Create winner records
            winners = self.create_winners_records(parsed)
            all_winners.extend(winners)
            
            print(f"  ✓ Extracted {len(winners)} winners")
            print(f"    1st: {parsed['first_prize']}")
            print(f"    2nd: {len(parsed['second_prizes'])} numbers")
            print(f"    3rd: {len(parsed['third_prizes'])} numbers")
        
        return all_winners
    
    def save_to_csv(self, winners: List[Dict], filename: str):
        """Save winners to CSV"""
        if not winners:
            return
        
        filepath = f"{self.output_dir}/csv/{filename}"
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=winners[0].keys())
            writer.writeheader()
            writer.writerows(winners)
        
        print(f"\n💾 Saved to CSV: {filepath}")
    
    def save_to_json(self, winners: List[Dict], filename: str):
        """Save winners to JSON"""
        if not winners:
            return
        
        filepath = f"{self.output_dir}/json/{filename}"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(winners, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Saved to JSON: {filepath}")
    
    def run_complete_scrape(self, denominations: Optional[List[int]] = None,
                           download_limit: Optional[int] = None):
        """Run complete scraping for all denominations"""
        
        if denominations is None:
            denominations = list(self.DENOMINATIONS.keys())
        
        print("\n" + "="*80)
        print("🚀 PAKISTAN PRIZE BONDS COMPLETE SCRAPER")
        print("="*80)
        print(f"📊 Denominations: {', '.join(f'Rs. {d}' for d in denominations)}")
        if download_limit:
            print(f"⚡ Limit: {download_limit} draws per denomination")
        print("="*80)
        
        start_time = datetime.now()
        
        all_winners = []
        
        for denom in denominations:
            if denom not in self.DENOMINATIONS:
                print(f"❌ Invalid denomination: {denom}")
                continue
            
            winners = self.scrape_and_parse_denomination(denom, download_limit)
            
            if winners:
                all_winners.extend(winners)
                
                # Save per denomination
                self.save_to_csv(winners, f"winners_{denom}.csv")
                self.save_to_json(winners, f"winners_{denom}.json")
        
        # Save combined data
        if all_winners:
            self.save_to_csv(all_winners, "all_winners_combined.csv")
            self.save_to_json(all_winners, "all_winners_combined.json")
        
        # Generate summary
        self.generate_summary(all_winners, start_time)
        
        print("\n🎉 SCRAPING COMPLETED!")
        print(f"📂 Check '{self.output_dir}' folder for all data\n")
    
    def generate_summary(self, all_winners: List[Dict], start_time: datetime):
        """Generate summary report"""
        end_time = datetime.now()
        duration = end_time - start_time
        
        summary_file = f"{self.output_dir}/SUMMARY_REPORT.txt"
        
        # Calculate statistics
        stats_by_denom = {}
        for winner in all_winners:
            denom = winner['denomination']
            if denom not in stats_by_denom:
                stats_by_denom[denom] = {
                    'total_winners': 0,
                    'first_prizes': 0,
                    'second_prizes': 0,
                    'third_prizes': 0,
                    'total_prize_money': 0
                }
            
            stats_by_denom[denom]['total_winners'] += 1
            
            # Map prize position to key
            prize_pos = winner['prize_position']
            if prize_pos == '1st':
                stats_by_denom[denom]['first_prizes'] += 1
            elif prize_pos == '2nd':
                stats_by_denom[denom]['second_prizes'] += 1
            elif prize_pos == '3rd':
                stats_by_denom[denom]['third_prizes'] += 1
            
            stats_by_denom[denom]['total_prize_money'] += winner['prize_amount']
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write("="*80 + "\n")
            f.write("PAKISTAN PRIZE BONDS - COMPLETE SCRAPING REPORT\n")
            f.write("="*80 + "\n\n")
            
            f.write(f"Generated: {end_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Duration: {duration}\n")
            f.write(f"Total Winners Extracted: {len(all_winners):,}\n\n")
            
            f.write("="*80 + "\n")
            f.write("BREAKDOWN BY DENOMINATION\n")
            f.write("="*80 + "\n\n")
            
            for denom in sorted(stats_by_denom.keys()):
                stats = stats_by_denom[denom]
                f.write(f"Rs. {denom} Prize Bonds:\n")
                f.write(f"  Total Winners: {stats['total_winners']:,}\n")
                f.write(f"  1st Prizes: {stats['first_prizes']}\n")
                f.write(f"  2nd Prizes: {stats['second_prizes']}\n")
                f.write(f"  3rd Prizes: {stats['third_prizes']:,}\n")
                f.write(f"  Total Prize Money: Rs. {stats['total_prize_money']:,}\n\n")
            
            f.write("="*80 + "\n")
            f.write("OUTPUT FILES\n")
            f.write("="*80 + "\n\n")
            f.write(f"CSV Files: {self.output_dir}/csv/\n")
            f.write(f"JSON Files: {self.output_dir}/json/\n")
            f.write(f"Raw TXT Files: {self.output_dir}/raw_txt/\n")
            f.write(f"Logs: {self.output_dir}/logs/\n\n")
            
            f.write("="*80 + "\n")
        
        print(f"\n📊 Summary Report: {summary_file}")


def main():
    """Main function"""
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║          PAKISTAN PRIZE BONDS COMPLETE SCRAPER & PARSER                      ║
║          Downloads TXT files and extracts ALL winning numbers                ║
╚══════════════════════════════════════════════════════════════════════════════╝
""")
    
    scraper = CompletePrizeBondScraper()
    
    # Interactive mode
    print("\n📊 Select Denominations:")
    print("  1. Rs. 100")
    print("  2. Rs. 200")
    print("  3. Rs. 750")
    print("  4. Rs. 1500")
    print("  5. Rs. 7500")
    print("  6. Rs. 15000")
    print("  7. Rs. 25000")
    print("  8. Rs. 40000")
    print("  9. ALL")
    
    choice = input("\nEnter choice (comma-separated or 'all'): ").strip().lower()
    
    if choice == 'all' or choice == '9':
        denominations = list(scraper.DENOMINATIONS.keys())
    else:
        denom_map = [100, 200, 750, 1500, 7500, 15000, 25000, 40000]
        try:
            indices = [int(x.strip()) for x in choice.split(',')]
            denominations = [denom_map[i-1] for i in indices if 1 <= i <= 8]
        except:
            print("Invalid input, using all denominations")
            denominations = list(scraper.DENOMINATIONS.keys())
    
    print(f"\n✓ Selected: {', '.join(f'Rs. {d}' for d in denominations)}")
    
    # Download limit
    limit = input("\nLimit draws per denomination (press Enter for all): ").strip()
    download_limit = int(limit) if limit.isdigit() else None
    
    # Run scraper
    scraper.run_complete_scrape(denominations=denominations, download_limit=download_limit)


if __name__ == "__main__":
    main()