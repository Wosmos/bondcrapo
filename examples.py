"""
Example Usage Scripts for Pakistan Prize Bonds Scraper

This file contains example scripts showing various ways to use the scraper.
"""

from pakistan_prize_bonds_scraper import PakistanPrizeBondScraper
from prize_bond_parser import PrizeBondResultParser
import json
import os


def example_1_basic_scraping():
    """Example 1: Basic scraping of all prize bonds"""
    print("\n" + "="*60)
    print("EXAMPLE 1: Basic Scraping")
    print("="*60)
    
    # Initialize scraper
    scraper = PakistanPrizeBondScraper(output_dir="prize_bonds_data")
    
    # Scrape all bond denominations
    metadata = scraper.scrape_all_bonds()
    
    # Generate report
    scraper.generate_report(metadata)
    
    print("\n✅ Basic scraping completed!")
    print("📁 Check prize_bonds_data/ folder for results")


def example_2_scrape_specific_denomination():
    """Example 2: Scrape only Rs. 100 prize bonds"""
    print("\n" + "="*60)
    print("EXAMPLE 2: Scrape Specific Denomination (Rs. 100)")
    print("="*60)
    
    scraper = PakistanPrizeBondScraper(output_dir="prize_bonds_data")
    
    # Scrape only Rs. 100 bonds
    draws_100 = scraper.scrape_draw_listings(100)
    
    print(f"\nFound {len(draws_100)} draws for Rs. 100 bonds")
    
    # Display recent draws
    print("\nMost recent draws:")
    for draw in draws_100[:5]:
        print(f"  - {draw['draw_date']} ({draw['file_type']})")
    
    # Save to file
    with open('prize_bonds_data/rs_100_only.json', 'w') as f:
        json.dump(draws_100, f, indent=2)
    
    print("\n✅ Saved to prize_bonds_data/rs_100_only.json")


def example_3_download_recent_results():
    """Example 3: Download only recent results (last 5 per denomination)"""
    print("\n" + "="*60)
    print("EXAMPLE 3: Download Recent Results Only")
    print("="*60)
    
    scraper = PakistanPrizeBondScraper(output_dir="prize_bonds_data")
    
    # First scrape metadata
    metadata = scraper.scrape_all_bonds()
    
    # Download only 5 most recent per denomination
    scraper.download_all_results(metadata, limit=5)
    
    print("\n✅ Downloaded recent results!")


def example_4_parse_downloaded_files():
    """Example 4: Parse downloaded files to extract winners"""
    print("\n" + "="*60)
    print("EXAMPLE 4: Parse Downloaded Files")
    print("="*60)
    
    parser = PrizeBondResultParser(input_dir="prize_bonds_data/raw_files")
    
    # Parse all downloaded files
    results = parser.parse_all_files()
    
    if results:
        # Save results
        parser.save_results(results)
        
        # Display sample results
        print("\nSample parsed results:")
        for result in results[:3]:
            if 'error' not in result:
                print(f"\n  File: {result.get('filename')}")
                print(f"  Date: {result.get('draw_date')}")
                print(f"  First Prize: {result.get('first_prize')}")
                print(f"  Location: {result.get('draw_location')}")
    
    print("\n✅ Parsing completed!")


def example_5_analyze_data():
    """Example 5: Analyze scraped data"""
    print("\n" + "="*60)
    print("EXAMPLE 5: Analyze Scraped Data")
    print("="*60)
    
    # Load the metadata
    metadata_file = "prize_bonds_data/all_draws_metadata.json"
    
    if os.path.exists(metadata_file):
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        print("\n📊 Data Analysis:")
        print("-" * 40)
        
        for denomination, draws in metadata.items():
            print(f"\nRs. {denomination} Prize Bonds:")
            print(f"  Total draws available: {len(draws)}")
            
            # Count by year
            years = {}
            for draw in draws:
                year = draw.get('year', 'Unknown')
                years[year] = years.get(year, 0) + 1
            
            print("  Draws by year:")
            for year in sorted(years.keys(), reverse=True):
                print(f"    {year}: {years[year]} draws")
            
            # Count by file type
            file_types = {}
            for draw in draws:
                ft = draw.get('file_type', 'Unknown')
                file_types[ft] = file_types.get(ft, 0) + 1
            
            print(f"  File types: {file_types}")
    else:
        print("❌ Metadata file not found. Please run the scraper first.")


def example_6_search_winning_number():
    """Example 6: Search for a specific number in all results"""
    print("\n" + "="*60)
    print("EXAMPLE 6: Search for Winning Number")
    print("="*60)
    
    # Example number to search
    search_number = "123456"
    
    parsed_file = "prize_bonds_data/parsed_results/parsed_results.json"
    
    if os.path.exists(parsed_file):
        with open(parsed_file, 'r') as f:
            results = json.load(f)
        
        print(f"\nSearching for number: {search_number}")
        print("-" * 40)
        
        found = False
        for result in results:
            if 'error' in result:
                continue
            
            # Check first prize
            if result.get('first_prize') == search_number:
                print(f"\n🎉 FIRST PRIZE WINNER!")
                print(f"  Date: {result.get('draw_date')}")
                print(f"  Denomination: Rs. {result.get('denomination')}")
                print(f"  Amount: Rs. {result.get('first_prize_amount'):,}")
                found = True
            
            # Check second prizes
            if search_number in result.get('second_prizes', []):
                print(f"\n🎊 SECOND PRIZE WINNER!")
                print(f"  Date: {result.get('draw_date')}")
                print(f"  Denomination: Rs. {result.get('denomination')}")
                print(f"  Amount: Rs. {result.get('second_prize_amount'):,}")
                found = True
            
            # Check third prizes
            if search_number in result.get('third_prizes', []):
                print(f"\n🎁 THIRD PRIZE WINNER!")
                print(f"  Date: {result.get('draw_date')}")
                print(f"  Denomination: Rs. {result.get('denomination')}")
                print(f"  Amount: Rs. {result.get('third_prize_amount'):,}")
                found = True
        
        if not found:
            print(f"\n❌ Number {search_number} was not found in any draws.")
    else:
        print("❌ Parsed results not found. Please run the parser first.")


def example_7_export_to_csv():
    """Example 7: Export specific denomination to CSV"""
    print("\n" + "="*60)
    print("EXAMPLE 7: Export to Custom CSV")
    print("="*60)
    
    import csv
    
    # Load Rs. 750 bond data
    json_file = "prize_bonds_data/json/draws_750.json"
    
    if os.path.exists(json_file):
        with open(json_file, 'r') as f:
            draws = json.load(f)
        
        # Create custom CSV with selected fields
        output_file = "prize_bonds_data/rs_750_summary.csv"
        
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Draw Date', 'Year', 'File Type', 'Download URL'])
            
            for draw in draws:
                writer.writerow([
                    draw.get('draw_date'),
                    draw.get('year'),
                    draw.get('file_type'),
                    draw.get('file_url')
                ])
        
        print(f"\n✅ Exported {len(draws)} draws to {output_file}")
    else:
        print("❌ Data file not found. Please run the scraper first.")


def main_menu():
    """Display example menu"""
    examples = {
        '1': ('Basic Scraping', example_1_basic_scraping),
        '2': ('Scrape Specific Denomination', example_2_scrape_specific_denomination),
        '3': ('Download Recent Results', example_3_download_recent_results),
        '4': ('Parse Downloaded Files', example_4_parse_downloaded_files),
        '5': ('Analyze Data', example_5_analyze_data),
        '6': ('Search Winning Number', example_6_search_winning_number),
        '7': ('Export to CSV', example_7_export_to_csv),
    }
    
    print("\n" + "="*60)
    print("PAKISTAN PRIZE BONDS SCRAPER - EXAMPLES")
    print("="*60)
    print("\nAvailable Examples:")
    print("-" * 60)
    
    for key, (name, _) in examples.items():
        print(f"  {key}. {name}")
    
    print("\n  0. Run All Examples")
    print("  q. Quit")
    print("-" * 60)
    
    choice = input("\nEnter your choice: ").strip().lower()
    
    if choice == '0':
        for name, func in examples.values():
            try:
                func()
                input("\nPress Enter to continue...")
            except Exception as e:
                print(f"\n❌ Error in {name}: {e}")
    elif choice in examples:
        name, func = examples[choice]
        try:
            func()
        except Exception as e:
            print(f"\n❌ Error: {e}")
    elif choice != 'q':
        print("\n❌ Invalid choice!")


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════╗
║     PAKISTAN PRIZE BONDS SCRAPER - EXAMPLE SCRIPTS       ║
╚══════════════════════════════════════════════════════════╝

This file contains example usage patterns for the scraper.
You can run specific examples or view them as reference.
""")
    
    main_menu()