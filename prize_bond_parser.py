"""
Advanced Prize Bond Result Parser
Parses downloaded draw result files to extract winner numbers
"""

import re
import os
import json
import csv
from typing import Dict, List, Optional
from datetime import datetime
import PyPDF2
from docx import Document


class PrizeBondResultParser:
    """Parse prize bond draw result files"""
    
    def __init__(self, input_dir: str = "prize_bonds_data/raw_files"):
        """
        Initialize the parser
        
        Args:
            input_dir: Directory containing raw draw files
        """
        self.input_dir = input_dir
        self.output_dir = "prize_bonds_data/parsed_results"
        os.makedirs(self.output_dir, exist_ok=True)
    
    def parse_txt_file(self, filepath: str) -> Dict:
        """
        Parse a text file containing draw results
        
        Args:
            filepath: Path to text file
            
        Returns:
            Dictionary with parsed results
        """
        print(f"Parsing: {os.path.basename(filepath)}")
        
        try:
            # Try different encodings
            for encoding in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    with open(filepath, 'r', encoding=encoding) as f:
                        content = f.read()
                    break
                except UnicodeDecodeError:
                    continue
            
            results = {
                'filename': os.path.basename(filepath),
                'denomination': self._extract_denomination(filepath),
                'draw_date': self._extract_date(filepath),
                'first_prize': None,
                'second_prizes': [],
                'third_prizes': [],
                'prize_amounts': {},
                'draw_number': None,
                'draw_location': None
            }
            
            # Extract draw information
            draw_info = self._extract_draw_info(content)
            results.update(draw_info)
            
            # Extract prize winners
            prizes = self._extract_prizes(content)
            results.update(prizes)
            
            return results
            
        except Exception as e:
            print(f"  Error parsing {filepath}: {e}")
            return {'error': str(e), 'filename': os.path.basename(filepath)}
    
    def _extract_denomination(self, filepath: str) -> Optional[int]:
        """Extract denomination from filename"""
        filename = os.path.basename(filepath)
        match = re.search(r'(\d+)_', filename)
        return int(match.group(1)) if match else None
    
    def _extract_date(self, filepath: str) -> Optional[str]:
        """Extract date from filename"""
        filename = os.path.basename(filepath)
        # Pattern: denomination_dd-mm-yyyy.ext
        match = re.search(r'_(\d{2}-\d{2}-\d{4})', filename)
        return match.group(1) if match else None
    
    def _extract_draw_info(self, content: str) -> Dict:
        """Extract draw metadata from content"""
        info = {}
        
        # Extract draw number
        draw_match = re.search(r'Draw\s*(?:No\.|Number|#)\s*:?\s*(\d+)', content, re.IGNORECASE)
        if draw_match:
            info['draw_number'] = int(draw_match.group(1))
        
        # Extract location
        locations = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Peshawar', 
                    'Quetta', 'Multan', 'Faisalabad', 'Hyderabad', 'Muzaffarabad']
        for location in locations:
            if location in content:
                info['draw_location'] = location
                break
        
        # Extract prize amounts
        prize_patterns = [
            (r'First\s+Prize\s*:?\s*Rs\.?\s*([\d,]+)', 'first_prize_amount'),
            (r'Second\s+Prize\s*:?\s*Rs\.?\s*([\d,]+)', 'second_prize_amount'),
            (r'Third\s+Prize\s*:?\s*Rs\.?\s*([\d,]+)', 'third_prize_amount'),
        ]
        
        for pattern, key in prize_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(',', '')
                info[key] = int(amount_str)
        
        return info
    
    def _extract_prizes(self, content: str) -> Dict:
        """Extract prize winning numbers"""
        prizes = {
            'first_prize': None,
            'second_prizes': [],
            'third_prizes': []
        }
        
        # Extract 6-digit numbers (typical prize bond number format)
        numbers = re.findall(r'\b\d{6}\b', content)
        
        # First prize - usually appears first or highlighted
        first_pattern = re.search(
            r'(?:First\s+Prize|1st\s+Prize)\s*:?\s*(\d{6})', 
            content, 
            re.IGNORECASE
        )
        if first_pattern:
            prizes['first_prize'] = first_pattern.group(1)
        
        # Second prizes - usually 3 prizes
        second_section = re.search(
            r'(?:Second\s+Prize|2nd\s+Prize)\s*:?\s*(.*?)(?:Third|3rd|$)',
            content,
            re.IGNORECASE | re.DOTALL
        )
        if second_section:
            second_numbers = re.findall(r'\b\d{6}\b', second_section.group(1))
            prizes['second_prizes'] = second_numbers[:3]  # Usually 3 second prizes
        
        # Third prizes - can be hundreds or thousands
        third_section = re.search(
            r'(?:Third\s+Prize|3rd\s+Prize)\s*:?\s*(.*?)$',
            content,
            re.IGNORECASE | re.DOTALL
        )
        if third_section:
            third_numbers = re.findall(r'\b\d{6}\b', third_section.group(1))
            prizes['third_prizes'] = third_numbers
        
        return prizes
    
    def parse_pdf_file(self, filepath: str) -> Dict:
        """
        Parse a PDF file containing draw results
        
        Args:
            filepath: Path to PDF file
            
        Returns:
            Dictionary with parsed results
        """
        print(f"Parsing PDF: {os.path.basename(filepath)}")
        
        try:
            with open(filepath, 'rb') as f:
                pdf_reader = PyPDF2.PdfReader(f)
                
                # Extract text from all pages
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text()
                
                # Use the same parsing logic as text files
                return self.parse_txt_file_from_content(text, filepath)
                
        except Exception as e:
            print(f"  Error parsing PDF {filepath}: {e}")
            return {'error': str(e), 'filename': os.path.basename(filepath)}
    
    def parse_docx_file(self, filepath: str) -> Dict:
        """
        Parse a DOCX file containing draw results
        
        Args:
            filepath: Path to DOCX file
            
        Returns:
            Dictionary with parsed results
        """
        print(f"Parsing DOCX: {os.path.basename(filepath)}")
        
        try:
            doc = Document(filepath)
            
            # Extract text from all paragraphs
            text = "\n".join([para.text for para in doc.paragraphs])
            
            # Use the same parsing logic
            return self.parse_txt_file_from_content(text, filepath)
            
        except Exception as e:
            print(f"  Error parsing DOCX {filepath}: {e}")
            return {'error': str(e), 'filename': os.path.basename(filepath)}
    
    def parse_txt_file_from_content(self, content: str, filepath: str) -> Dict:
        """Helper method to parse content regardless of source"""
        results = {
            'filename': os.path.basename(filepath),
            'denomination': self._extract_denomination(filepath),
            'draw_date': self._extract_date(filepath),
            'first_prize': None,
            'second_prizes': [],
            'third_prizes': [],
            'prize_amounts': {},
            'draw_number': None,
            'draw_location': None
        }
        
        draw_info = self._extract_draw_info(content)
        results.update(draw_info)
        
        prizes = self._extract_prizes(content)
        results.update(prizes)
        
        return results
    
    def parse_all_files(self) -> List[Dict]:
        """
        Parse all files in the input directory
        
        Returns:
            List of parsed results
        """
        print("="*60)
        print("PARSING DRAW RESULT FILES")
        print("="*60)
        
        all_results = []
        
        if not os.path.exists(self.input_dir):
            print(f"Input directory not found: {self.input_dir}")
            return all_results
        
        files = os.listdir(self.input_dir)
        print(f"\nFound {len(files)} files to parse\n")
        
        for filename in sorted(files):
            filepath = os.path.join(self.input_dir, filename)
            
            if filename.endswith('.txt'):
                result = self.parse_txt_file(filepath)
            elif filename.endswith('.pdf'):
                result = self.parse_pdf_file(filepath)
            elif filename.endswith('.docx') or filename.endswith('.doc'):
                result = self.parse_docx_file(filepath)
            else:
                continue
            
            all_results.append(result)
        
        return all_results
    
    def save_results(self, results: List[Dict]):
        """
        Save parsed results to files
        
        Args:
            results: List of parsed results
        """
        # Save to JSON
        json_path = os.path.join(self.output_dir, 'parsed_results.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\n✅ Saved JSON: {json_path}")
        
        # Save to CSV
        if results:
            csv_path = os.path.join(self.output_dir, 'parsed_results.csv')
            
            # Flatten the data for CSV
            flattened = []
            for r in results:
                flat = {
                    'filename': r.get('filename'),
                    'denomination': r.get('denomination'),
                    'draw_date': r.get('draw_date'),
                    'draw_number': r.get('draw_number'),
                    'draw_location': r.get('draw_location'),
                    'first_prize': r.get('first_prize'),
                    'first_prize_amount': r.get('first_prize_amount'),
                    'second_prizes': '|'.join(r.get('second_prizes', [])),
                    'second_prize_amount': r.get('second_prize_amount'),
                    'third_prize_count': len(r.get('third_prizes', [])),
                    'third_prize_amount': r.get('third_prize_amount'),
                }
                flattened.append(flat)
            
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                if flattened:
                    writer = csv.DictWriter(f, fieldnames=flattened[0].keys())
                    writer.writeheader()
                    writer.writerows(flattened)
            
            print(f"✅ Saved CSV: {csv_path}")
        
        # Generate summary
        self._generate_summary(results)
    
    def _generate_summary(self, results: List[Dict]):
        """Generate a summary report"""
        summary_path = os.path.join(self.output_dir, 'parsing_summary.txt')
        
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write("="*60 + "\n")
            f.write("PRIZE BOND PARSING SUMMARY\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("="*60 + "\n\n")
            
            f.write(f"Total files parsed: {len(results)}\n")
            
            # Count by denomination
            by_denom = {}
            for r in results:
                denom = r.get('denomination', 'Unknown')
                by_denom[denom] = by_denom.get(denom, 0) + 1
            
            f.write("\nBy Denomination:\n")
            for denom in sorted(by_denom.keys()):
                f.write(f"  Rs. {denom}: {by_denom[denom]} draws\n")
            
            # Count successful parses
            successful = sum(1 for r in results if 'error' not in r)
            failed = len(results) - successful
            
            f.write(f"\nParsing Results:\n")
            f.write(f"  Successfully parsed: {successful}\n")
            f.write(f"  Failed to parse: {failed}\n")
            
            if failed > 0:
                f.write("\nFailed files:\n")
                for r in results:
                    if 'error' in r:
                        f.write(f"  - {r['filename']}: {r['error']}\n")
        
        print(f"✅ Saved summary: {summary_path}")


def main():
    """Main execution"""
    print("="*60)
    print("PRIZE BOND RESULT PARSER")
    print("="*60)
    
    parser = PrizeBondResultParser()
    
    # Parse all files
    results = parser.parse_all_files()
    
    if results:
        # Save results
        parser.save_results(results)
        
        print(f"\n✅ Parsing completed!")
        print(f"📁 Results saved to: {parser.output_dir}/")
    else:
        print("\n⚠️  No files found to parse.")
        print("    Please run the scraper first to download draw files.")


if __name__ == "__main__":
    main()