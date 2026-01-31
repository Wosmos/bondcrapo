"""
Prize Bond Data Analysis Utilities

This module provides functions for analyzing scraped prize bond data,
including statistics, trends, and number frequency analysis.
"""

import json
import os
from collections import Counter, defaultdict
from datetime import datetime
from typing import Dict, List, Optional
import csv


class PrizeBondAnalyzer:
    """Analyze prize bond data"""
    
    def __init__(self, data_dir: str = "prize_bonds_data"):
        """
        Initialize analyzer
        
        Args:
            data_dir: Directory containing scraped data
        """
        self.data_dir = data_dir
        self.metadata_file = os.path.join(data_dir, "all_draws_metadata.json")
        self.parsed_file = os.path.join(data_dir, "parsed_results", "parsed_results.json")
    
    def load_metadata(self) -> Optional[Dict]:
        """Load draw metadata"""
        if os.path.exists(self.metadata_file):
            with open(self.metadata_file, 'r') as f:
                return json.load(f)
        return None
    
    def load_parsed_results(self) -> Optional[List[Dict]]:
        """Load parsed results"""
        if os.path.exists(self.parsed_file):
            with open(self.parsed_file, 'r') as f:
                return json.load(f)
        return None
    
    def analyze_frequency(self, denomination: Optional[int] = None) -> Dict:
        """
        Analyze number frequency in winning draws
        
        Args:
            denomination: Specific denomination to analyze (None for all)
            
        Returns:
            Dictionary with frequency analysis
        """
        results = self.load_parsed_results()
        if not results:
            return {}
        
        # Filter by denomination if specified
        if denomination:
            results = [r for r in results if r.get('denomination') == denomination]
        
        all_numbers = []
        first_prizes = []
        
        for result in results:
            if 'error' in result:
                continue
            
            # Collect first prize
            if result.get('first_prize'):
                first_prizes.append(result['first_prize'])
                all_numbers.append(result['first_prize'])
            
            # Collect second prizes
            for num in result.get('second_prizes', []):
                all_numbers.append(num)
            
            # Collect third prizes
            for num in result.get('third_prizes', []):
                all_numbers.append(num)
        
        # Analyze digit frequency
        digit_frequency = defaultdict(int)
        for number in all_numbers:
            for digit in str(number):
                digit_frequency[digit] += 1
        
        # Analyze starting digits
        starting_digits = Counter([str(num)[0] for num in all_numbers if num])
        
        # Analyze ending digits
        ending_digits = Counter([str(num)[-1] for num in all_numbers if num])
        
        return {
            'total_winning_numbers': len(all_numbers),
            'unique_numbers': len(set(all_numbers)),
            'digit_frequency': dict(sorted(digit_frequency.items())),
            'starting_digit_frequency': dict(sorted(starting_digits.items())),
            'ending_digit_frequency': dict(sorted(ending_digits.items())),
            'most_common_first_prizes': Counter(first_prizes).most_common(10)
        }
    
    def analyze_prize_trends(self) -> Dict:
        """Analyze prize amount trends over time"""
        results = self.load_parsed_results()
        if not results:
            return {}
        
        trends = {}
        
        for result in results:
            if 'error' in result:
                continue
            
            denom = result.get('denomination')
            if not denom:
                continue
            
            if denom not in trends:
                trends[denom] = {
                    'first_prize_amounts': [],
                    'second_prize_amounts': [],
                    'third_prize_amounts': [],
                    'draw_count': 0
                }
            
            trends[denom]['draw_count'] += 1
            
            if result.get('first_prize_amount'):
                trends[denom]['first_prize_amounts'].append(result['first_prize_amount'])
            if result.get('second_prize_amount'):
                trends[denom]['second_prize_amounts'].append(result['second_prize_amount'])
            if result.get('third_prize_amount'):
                trends[denom]['third_prize_amounts'].append(result['third_prize_amount'])
        
        # Calculate averages
        summary = {}
        for denom, data in trends.items():
            summary[denom] = {
                'total_draws': data['draw_count'],
                'avg_first_prize': sum(data['first_prize_amounts']) / len(data['first_prize_amounts']) if data['first_prize_amounts'] else 0,
                'avg_second_prize': sum(data['second_prize_amounts']) / len(data['second_prize_amounts']) if data['second_prize_amounts'] else 0,
                'avg_third_prize': sum(data['third_prize_amounts']) / len(data['third_prize_amounts']) if data['third_prize_amounts'] else 0,
            }
        
        return summary
    
    def get_draw_statistics(self) -> Dict:
        """Get overall draw statistics"""
        metadata = self.load_metadata()
        if not metadata:
            return {}
        
        stats = {
            'total_denominations': len(metadata),
            'by_denomination': {}
        }
        
        total_draws = 0
        
        for denom, draws in metadata.items():
            total_draws += len(draws)
            
            # Count by year
            years = {}
            for draw in draws:
                year = draw.get('year', 'Unknown')
                years[year] = years.get(year, 0) + 1
            
            # Count by file type
            file_types = {}
            for draw in draws:
                ft = draw.get('file_type', 'Unknown')
                file_types[ft] = file_types.get(ft, 0) + 1
            
            stats['by_denomination'][denom] = {
                'total_draws': len(draws),
                'years_covered': sorted(years.keys(), reverse=True),
                'draws_by_year': years,
                'file_types': file_types,
                'earliest_draw': min([d.get('draw_date', '') for d in draws]) if draws else None,
                'latest_draw': max([d.get('draw_date', '') for d in draws]) if draws else None,
            }
        
        stats['total_draws'] = total_draws
        
        return stats
    
    def find_number(self, number: str) -> List[Dict]:
        """
        Search for a specific number across all draws
        
        Args:
            number: 6-digit number to search
            
        Returns:
            List of winning instances
        """
        results = self.load_parsed_results()
        if not results:
            return []
        
        wins = []
        
        for result in results:
            if 'error' in result:
                continue
            
            prize_type = None
            prize_amount = None
            
            # Check first prize
            if result.get('first_prize') == number:
                prize_type = 'First Prize'
                prize_amount = result.get('first_prize_amount')
            
            # Check second prizes
            elif number in result.get('second_prizes', []):
                prize_type = 'Second Prize'
                prize_amount = result.get('second_prize_amount')
            
            # Check third prizes
            elif number in result.get('third_prizes', []):
                prize_type = 'Third Prize'
                prize_amount = result.get('third_prize_amount')
            
            if prize_type:
                wins.append({
                    'number': number,
                    'prize_type': prize_type,
                    'prize_amount': prize_amount,
                    'denomination': result.get('denomination'),
                    'draw_date': result.get('draw_date'),
                    'draw_location': result.get('draw_location'),
                    'draw_number': result.get('draw_number')
                })
        
        return wins
    
    def generate_analysis_report(self, output_file: str = "analysis_report.txt"):
        """Generate a comprehensive analysis report"""
        output_path = os.path.join(self.data_dir, output_file)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("="*70 + "\n")
            f.write("PAKISTAN PRIZE BONDS - DATA ANALYSIS REPORT\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("="*70 + "\n\n")
            
            # Draw Statistics
            f.write("1. DRAW STATISTICS\n")
            f.write("-"*70 + "\n")
            
            stats = self.get_draw_statistics()
            if stats:
                f.write(f"Total Denominations: {stats.get('total_denominations', 0)}\n")
                f.write(f"Total Draws: {stats.get('total_draws', 0)}\n\n")
                
                for denom, data in stats.get('by_denomination', {}).items():
                    f.write(f"\nRs. {denom} Prize Bonds:\n")
                    f.write(f"  Total Draws: {data['total_draws']}\n")
                    f.write(f"  Years Covered: {', '.join(data['years_covered'])}\n")
                    f.write(f"  Earliest Draw: {data['earliest_draw']}\n")
                    f.write(f"  Latest Draw: {data['latest_draw']}\n")
                    f.write(f"  File Types: {data['file_types']}\n")
            
            # Prize Trends
            f.write("\n\n2. PRIZE AMOUNT TRENDS\n")
            f.write("-"*70 + "\n")
            
            trends = self.analyze_prize_trends()
            for denom, data in trends.items():
                f.write(f"\nRs. {denom} Prize Bonds:\n")
                f.write(f"  Total Draws Analyzed: {data['total_draws']}\n")
                f.write(f"  Average First Prize: Rs. {data['avg_first_prize']:,.0f}\n")
                f.write(f"  Average Second Prize: Rs. {data['avg_second_prize']:,.0f}\n")
                f.write(f"  Average Third Prize: Rs. {data['avg_third_prize']:,.0f}\n")
            
            # Number Frequency Analysis
            f.write("\n\n3. NUMBER FREQUENCY ANALYSIS\n")
            f.write("-"*70 + "\n")
            
            for denom in [100, 200, 750, 1500, 25000, 40000]:
                freq = self.analyze_frequency(denomination=denom)
                if freq.get('total_winning_numbers', 0) > 0:
                    f.write(f"\nRs. {denom} Prize Bonds:\n")
                    f.write(f"  Total Winning Numbers: {freq['total_winning_numbers']}\n")
                    f.write(f"  Unique Numbers: {freq['unique_numbers']}\n")
                    
                    f.write("\n  Starting Digit Frequency:\n")
                    for digit, count in sorted(freq['starting_digit_frequency'].items(), 
                                              key=lambda x: x[1], reverse=True):
                        f.write(f"    {digit}: {count}\n")
                    
                    f.write("\n  Ending Digit Frequency:\n")
                    for digit, count in sorted(freq['ending_digit_frequency'].items(), 
                                              key=lambda x: x[1], reverse=True):
                        f.write(f"    {digit}: {count}\n")
            
            f.write("\n" + "="*70 + "\n")
        
        print(f"✅ Analysis report saved to: {output_path}")
        return output_path


def main():
    """Main execution"""
    print("="*60)
    print("PRIZE BOND DATA ANALYZER")
    print("="*60)
    
    analyzer = PrizeBondAnalyzer()
    
    print("\n📊 Generating analysis report...")
    analyzer.generate_analysis_report()
    
    print("\n📈 Getting draw statistics...")
    stats = analyzer.get_draw_statistics()
    
    if stats:
        print(f"\nTotal draws in database: {stats.get('total_draws', 0)}")
        print(f"Denominations covered: {stats.get('total_denominations', 0)}")
    
    print("\n💰 Analyzing prize trends...")
    trends = analyzer.analyze_prize_trends()
    
    if trends:
        print("\nAverage Prize Amounts:")
        for denom, data in sorted(trends.items()):
            print(f"\n  Rs. {denom}:")
            print(f"    First Prize: Rs. {data['avg_first_prize']:,.0f}")
            print(f"    Second Prize: Rs. {data['avg_second_prize']:,.0f}")
            print(f"    Third Prize: Rs. {data['avg_third_prize']:,.0f}")
    
    # Example: Search for a number
    print("\n\n🔍 Number Search Example:")
    search = input("Enter a 6-digit number to search (or press Enter to skip): ").strip()
    
    if search and len(search) == 6 and search.isdigit():
        wins = analyzer.find_number(search)
        
        if wins:
            print(f"\n🎉 Found {len(wins)} winning instance(s):")
            for win in wins:
                print(f"\n  {win['prize_type']} - Rs. {win['prize_amount']:,}")
                print(f"  Date: {win['draw_date']}")
                print(f"  Denomination: Rs. {win['denomination']}")
        else:
            print(f"\n❌ Number {search} not found in any draws.")
    
    print("\n✅ Analysis completed!")


if __name__ == "__main__":
    main()