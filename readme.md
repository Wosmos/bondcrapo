# Pakistan Prize Bonds Web Scraper

A comprehensive Python web scraper for collecting and parsing Pakistan's official prize bond data from the National Savings website (savings.gov.pk).

## 🎯 Features

- **Complete Coverage**: Scrapes all prize bond denominations (Rs. 100, 200, 750, 1500, 25000, 40000)
- **Historical Data**: Collects all available historical draw results
- **Multiple Formats**: Downloads results in TXT, PDF, and DOCX formats
- **Data Parsing**: Extracts winner numbers and prize information
- **Structured Output**: Saves data in JSON and CSV formats
- **Rate Limiting**: Respects server resources with appropriate delays
- **Error Handling**: Robust error handling and retry mechanisms

## 📋 What Data is Collected

### Draw Metadata
- Draw dates
- Draw numbers
- Draw locations (Karachi, Lahore, Islamabad, etc.)
- File URLs and types

### Prize Information
- First prize winner and amount
- Second prize winners (usually 3) and amounts
- Third prize winners and amounts
- Complete lists of all winning numbers

### Bond Information
- All denominations: Rs. 100, 200, 750, 1500, 25000, 40000
- Historical data from 2019 onwards
- Premium prize bonds information

## 🚀 Quick Start

### Installation

1. **Clone or download the scripts**

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

### Usage

#### Step 1: Scrape Draw Listings

Run the main scraper to collect all draw metadata:

```bash
python pakistan_prize_bonds_scraper.py
```

This will:
- Scrape all prize bond denomination pages
- Collect metadata about all draws
- Save the information to JSON and CSV files
- Optionally download all draw result files

**Output Structure:**
```
prize_bonds_data/
├── json/
│   ├── draws_100.json
│   ├── draws_200.json
│   ├── draws_750.json
│   ├── draws_1500.json
│   ├── draws_25000.json
│   └── draws_40000.json
├── csv/
│   ├── draws_100.csv
│   ├── draws_200.csv
│   └── ...
├── raw_files/
│   ├── 100_15-02-2025.txt
│   ├── 200_15-05-2024.pdf
│   └── ...
├── all_draws_metadata.json
└── scraping_report.txt
```

#### Step 2: Parse Draw Results (Optional)

After downloading the draw files, parse them to extract winner numbers:

```bash
python prize_bond_parser.py
```

This will:
- Parse all downloaded TXT, PDF, and DOCX files
- Extract winner numbers and prize amounts
- Save parsed results to JSON and CSV

**Output:**
```
prize_bonds_data/parsed_results/
├── parsed_results.json
├── parsed_results.csv
└── parsing_summary.txt
```

## 📊 Data Format Examples

### Draw Metadata (JSON)
```json
{
  "denomination": 100,
  "draw_date": "15-02-2025",
  "year": "2025",
  "file_url": "https://savings.gov.pk/wp-content/uploads/2025/02/Rs.100-49th-Draw-RWP-Final.txt",
  "file_type": "txt"
}
```

### Parsed Results (JSON)
```json
{
  "filename": "100_15-02-2025.txt",
  "denomination": 100,
  "draw_date": "15-02-2025",
  "draw_number": 49,
  "draw_location": "Rawalpindi",
  "first_prize": "123456",
  "first_prize_amount": 700000,
  "second_prizes": ["234567", "345678", "456789"],
  "second_prize_amount": 200000,
  "third_prizes": ["567890", "678901", ...],
  "third_prize_amount": 1000
}
```

## 🔧 Advanced Usage

### Custom Output Directory

```python
from pakistan_prize_bonds_scraper import PakistanPrizeBondScraper

scraper = PakistanPrizeBondScraper(output_dir="my_custom_directory")
metadata = scraper.scrape_all_bonds()
```

### Scrape Specific Denomination

```python
scraper = PakistanPrizeBondScraper()
draws_100 = scraper.scrape_draw_listings(100)
```

### Download Limited Files

```python
# Download only the 10 most recent draws per denomination
scraper.download_all_results(metadata, limit=10)
```

### Parse Specific File

```python
from prize_bond_parser import PrizeBondResultParser

parser = PrizeBondResultParser()
result = parser.parse_txt_file("prize_bonds_data/raw_files/100_15-02-2025.txt")
```

## 📁 File Types Handled

The scraper can handle multiple file formats:

- **TXT**: Plain text files (most common)
- **PDF**: PDF documents
- **DOCX/DOC**: Microsoft Word documents

## ⚙️ Configuration Options

### Main Scraper Options

- `output_dir`: Directory to save scraped data (default: "prize_bonds_data")
- `max_retries`: Maximum retry attempts for failed requests (default: 3)

### Parser Options

- `input_dir`: Directory containing raw draw files (default: "prize_bonds_data/raw_files")

## 🌐 Data Sources

All data is scraped from official Pakistan government sources:

- **Primary Source**: [National Savings Pakistan](https://savings.gov.pk)
- **Prize Bonds Page**: https://savings.gov.pk/prize-bonds/
- **Download Draws**: https://savings.gov.pk/download-draws/

## 📌 Important Notes

### Legal & Ethical
- This scraper only accesses **publicly available** data
- All data is from official government websites
- The scraper respects rate limits and server resources
- For personal use and research purposes

### Data Accuracy
- Data is scraped directly from official sources
- Parsing accuracy depends on file format consistency
- Always verify critical information from official sources

### Rate Limiting
- The scraper includes delays between requests (1-2 seconds)
- Adjust `time.sleep()` values if needed
- Be respectful of server resources

## 🛠️ Troubleshooting

### Common Issues

**Issue**: "No files found to parse"
- **Solution**: Run the main scraper first to download draw files

**Issue**: Unicode decode errors
- **Solution**: The parser tries multiple encodings automatically

**Issue**: Failed to fetch pages
- **Solution**: Check your internet connection and try again

**Issue**: Parsing errors for specific files
- **Solution**: File format may vary; check the parsing_summary.txt for details

## 📈 Future Enhancements

Potential improvements:
- [ ] Automated scheduling for regular updates
- [ ] Database integration (SQLite/PostgreSQL)
- [ ] Web interface for browsing results
- [ ] Statistical analysis features
- [ ] Number frequency analysis
- [ ] Email notifications for new draws
- [ ] Export to Excel with formatting

## 🤝 Contributing

Suggestions and improvements are welcome! Some ways to contribute:
- Report bugs or issues
- Suggest new features
- Improve parsing accuracy
- Add support for additional file formats

## 📄 License

This project is for educational and personal use. Please respect the terms of service of the source websites.

## ⚠️ Disclaimer

This tool is provided for informational purposes only. The author is not responsible for any misuse or inaccuracies in the scraped data. Always verify important information from official sources.

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the parsing_summary.txt and scraping_report.txt files
3. Ensure all dependencies are installed correctly

## 🎓 Learning Resources

Understanding web scraping:
- BeautifulSoup Documentation: https://www.crummy.com/software/BeautifulSoup/
- Requests Library: https://requests.readthedocs.io/
- Web Scraping Best Practices

---

**Last Updated**: February 2026
**Version**: 1.0.0
**Author**: Custom Pakistan Prize Bonds Scraper

Happy scraping! 🎉