        const API_BASE = ''; // Keep empty if hosted on same origin
        let bondGrid;

        document.addEventListener('DOMContentLoaded', () => {
            initGrid();
            fetchStats();
            setupFilterListeners();
            toggleSearchMode(); // Initialize default mode
        });

        // 0. UI HELPERS
        function toggleSearchMode() {
            const mode = document.getElementById('search-mode').value;
            // Hide all first
            document.querySelectorAll('.search-mode-div').forEach(div => div.classList.add('hidden'));
            
            if (mode === 'mixed') {
                // Show both List and Series inputs
                document.getElementById('mode-multi').classList.remove('hidden');
                document.getElementById('mode-series').classList.remove('hidden');
            } else {
                // Standard single mode display
                document.getElementById(`mode-${mode}`).classList.remove('hidden');
            }
        }

        function toggleAdvancedFilters() {
            const filters = document.getElementById('advanced-filters');
            const icon = document.getElementById('adv-icon');
            
            if (filters.classList.contains('hidden')) {
                filters.classList.remove('hidden');
                icon.style.transform = 'rotate(180deg)';
            } else {
                filters.classList.add('hidden');
                icon.style.transform = 'rotate(0deg)';
            }
        }

        // --- SCANNER LOGIC ---
        let extractedBonds = [];

        function openScanner() {
            document.getElementById('scanner-modal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            resetScanner();
        }

        function closeScanner() {
            document.getElementById('scanner-modal').classList.add('hidden');
            document.body.style.overflow = 'auto';
        }

        function resetScanner() {
            document.getElementById('drop-zone').classList.remove('hidden');
            document.getElementById('scan-progress').classList.add('hidden');
            document.getElementById('scan-results').classList.add('hidden');
            document.getElementById('progress-bar').style.width = '0%';
            extractedBonds = [];
        }

        async function processFile(file) {
            if (!file) return;
            
            document.getElementById('drop-zone').classList.add('hidden');
            document.getElementById('scan-progress').classList.remove('hidden');
            const statusBox = document.getElementById('progress-status');
            const percentBox = document.getElementById('progress-percent');
            const bar = document.getElementById('progress-bar');

            try {
                let text = "";
                const fileType = file.type;
                const fileName = file.name.toLowerCase();

                if (fileType === "application/pdf" || fileName.endsWith('.pdf')) {
                    statusBox.innerText = "Extracting PDF Text...";
                    text = await extractTextFromPDF(file, (p) => {
                        percentBox.innerText = p + '%';
                        bar.style.width = p + '%';
                    });
                } else if (fileType === "text/plain" || fileName.endsWith('.txt')) {
                    statusBox.innerText = "Reading Text File...";
                    text = await file.text();
                    bar.style.width = '100%';
                    percentBox.innerText = '100%';
                } else {
                    // Assume Image for OCR
                    statusBox.innerText = "Running AI OCR...";
                    const worker = await Tesseract.createWorker({
                        logger: m => {
                            if (m.status === 'recognizing text') {
                                const p = Math.floor(m.progress * 100);
                                percentBox.innerText = p + '%';
                                bar.style.width = p + '%';
                            }
                        }
                    });
                    await worker.loadLanguage('eng');
                    await worker.initialize('eng');
                    await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
                    const result = await worker.recognize(file);
                    text = result.data.text;
                    await worker.terminate();
                }

                // Extract unique 6-digit numbers
                const matches = text.match(/\b\d{6}\b/g) || [];
                extractedBonds = [...new Set(matches)];

                displayResults();
            } catch (err) {
                console.error("Extraction Error", err);
                alert("Failed to process file. Ensure it is a valid document.");
                resetScanner();
            }
        }

        async function extractTextFromPDF(file, onProgress) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = "";
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const strings = content.items.map(item => item.str);
                fullText += strings.join(" ") + " ";
                if (onProgress) onProgress(Math.floor((i / pdf.numPages) * 100));
            }
            return fullText;
        }

        function displayResults() {
            document.getElementById('scan-progress').classList.add('hidden');
            document.getElementById('scan-results').classList.remove('hidden');
            const container = document.getElementById('found-numbers');
            
            if (extractedBonds.length === 0) {
                container.innerHTML = `<span class="text-xs text-gray-500 italic">No 6-digit numbers found. Try another image.</span>`;
            } else {
                container.innerHTML = extractedBonds.map(num => `
                    <span class="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono font-bold text-onyx-900 shadow-sm">${num}</span>
                `).join('');
            }
        }

        function applyFoundNumbers() {
            if (extractedBonds.length > 0) {
                const currentList = document.getElementById('bond-list').value;
                const newList = [currentList, ...extractedBonds].filter(x => x).join(', ');
                document.getElementById('bond-list').value = newList;
                
                // Switch to mixed or multi mode automatically
                const modeSelect = document.getElementById('search-mode');
                if (modeSelect.value === 'single' || modeSelect.value === 'series') {
                    modeSelect.value = 'multi';
                    toggleSearchMode();
                }
                
                updateGridConfig();
            }
            closeScanner();
        }

        // 1. GRID INITIALIZATION (Using Grid.js)
        function initGrid() {
            bondGrid = new gridjs.Grid({
                columns: [
                    { id: 'index', name: '#', width: '60px', sort: false,
                        formatter: (cell) => gridjs.html(`<span class="font-bold text-gray-400">${cell}</span>`)
                    },
                    { id: 'bond_number', name: 'Bond #', 
                      formatter: (cell) => gridjs.html(`
                        <div class="relative group/copy cursor-pointer flex items-center gap-2 copyable" onclick="copyToClipboard('${cell}', this)">
                            <span class="font-mono font-bold text-onyx-900 text-base">${cell}</span>
                            <svg class="w-3 h-3 text-gray-300 opacity-0 group-hover/copy:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                            <span class="copy-tooltip">Copy</span>
                        </div>
                      `) 
                    },
                    { id: 'denomination', name: 'Value',
                      formatter: (cell) => `Rs. ${cell}` 
                    },
                    { id: 'prize_position', name: 'Rank', 
                      formatter: (cell) => {
                          let color = cell.includes('1st') ? 'text-amber-600 bg-amber-50 border-amber-200' : 
                                      cell.includes('2nd') ? 'text-blue-600 bg-blue-50 border-blue-200' : 
                                      'text-emerald-600 bg-emerald-50 border-emerald-200';
                          return gridjs.html(`<span class="px-2 py-1 text-xs font-bold uppercase border rounded-sm ${color}">${cell}</span>`);
                      }
                    },
                    { id: 'prize_amount', name: 'Prize', 
                      formatter: (cell) => gridjs.html(`<span class="font-mono font-semibold">Rs. ${cell.toLocaleString()}</span>`) 
                    },
                    { id: 'draw_date', name: 'Date', 
                      formatter: (cell, row) => gridjs.html(`<span class="text-gray-600 font-medium">${formatDate(cell || row.cells[5].data)}</span>`)
                    },
                    { id: 'draw_year', name: 'Year', hidden: true }
                ],
                server: {
                    url: `${API_BASE}/api/draws`,
                    then: data => data.draws.map((draw, index) => [
                        index + 1,
                        draw.bond_number,
                        draw.denomination,
                        draw.prize_position,
                        draw.prize_amount,
                        draw.draw_date,
                        draw.draw_year
                    ]),
                    total: data => data.total
                },
                pagination: {
                    enabled: true,
                    limit: parseInt(document.getElementById('row-limit').value) || 10,
                    server: {
                        url: (prev, page, limit) => `${prev}?limit=${limit}&offset=${page * limit}`
                    },
                    summary: true // Shows "Displaying 1 to 10 of..."
                },
                style: { 
                    table: { 'white-space': 'nowrap' }
                },
                className: {
                    table: 'w-full text-left',
                }
            }).render(document.getElementById("grid-wrapper"));
        }

        // 2. SEARCH & FILTER LOGIC
        function updateGridConfig() {
            const gridEl = document.getElementById("grid-wrapper");
            gridEl.style.opacity = "0.5";
            
            const searchMode = document.getElementById('search-mode').value;
            const bondNum = document.getElementById('bond-number').value.trim();
            const bondList = document.getElementById('bond-list').value.trim();
            const startBond = document.getElementById('start-bond').value.trim();
            const endBond = document.getElementById('end-bond').value.trim();

            const denom = document.getElementById('denom-filter').value;
            const rank = document.getElementById('rank-filter').value;
            const year = document.getElementById('year-filter').value;
            const sortBy = document.getElementById('sort-filter').value;
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            const minAmount = document.getElementById('min-amount').value;
            
            // Handle row limit
            const limitSelect = document.getElementById('row-limit');
            const customInput = document.getElementById('custom-rows');
            let limit = parseInt(limitSelect.value);
            if (limitSelect.value === 'custom') {
                limit = parseInt(customInput.value) || 10;
            }

            // Helper to build search params
            const getSearchParams = () => {
                let p = '';
                // In single mode, only bond_number
                if (searchMode === 'single' && bondNum) p += `&bond_number=${bondNum}`;
                
                // In multi or mixed mode, check bond_list
                if ((searchMode === 'multi' || searchMode === 'mixed') && bondList) p += `&bond_list=${bondList}`;
                
                // In series or mixed mode, check series
                if (searchMode === 'series' || searchMode === 'mixed') {
                    if (startBond) p += `&start_bond=${startBond}`;
                    if (endBond) p += `&end_bond=${endBond}`;
                }
                
                if (denom) p += `&denomination=${denom}`;
                if (rank) p += `&position=${rank}`;
                if (year) p += `&year=${year}`;
                if (sortBy) p += `&sort_by=${sortBy}`;
                if (startDate) p += `&start_date=${startDate}`;
                if (endDate) p += `&end_date=${endDate}`;
                if (minAmount) p += `&min_amount=${minAmount}`;
                return p;
            };

            // Grid.js Server-side URL Generator
            const urlGenerator = (prev, page, limit) => {
                return `${API_BASE}/api/draws?limit=${limit}&offset=${page * limit}${getSearchParams()}`;
            };

            // Force update the grid configuration
            bondGrid.updateConfig({
                pagination: {
                    enabled: true,
                    limit: limit,
                    server: { url: urlGenerator }
                },
                server: {
                    url: `${API_BASE}/api/draws?limit=${limit}${getSearchParams()}`,
                    then: data => {
                        gridEl.style.opacity = "1";
                        if (!data.draws) return [];
                        return data.draws.map((draw, index) => [
                            index + 1,
                            draw.bond_number,
                            draw.denomination,
                            draw.prize_position,
                            draw.prize_amount,
                            draw.draw_date,
                            draw.draw_year
                        ]);
                    },
                    total: data => data.total || 0
                }
            }).forceRender();
        }

        function resetFilters() {
            document.getElementById('search-mode').value = 'single';
            toggleSearchMode();
            document.getElementById('denom-filter').value = '';
            document.getElementById('rank-filter').value = '';
            document.getElementById('year-filter').value = '';
            document.getElementById('sort-filter').value = 'draw_date';
            document.getElementById('bond-number').value = '';
            document.getElementById('bond-list').value = '';
            document.getElementById('start-bond').value = '';
            document.getElementById('end-bond').value = '';
            document.getElementById('row-limit').value = '50';
            document.getElementById('start-date').value = '';
            document.getElementById('end-date').value = '';
            document.getElementById('min-amount').value = '';
            document.getElementById('custom-rows').classList.add('hidden');
            updateGridConfig();
        }

        function refreshData() {
            fetchStats();
            updateGridConfig();
        }

        // 3. STATS FETCHING
        async function fetchStats() {
            try {
                const res = await fetch(`${API_BASE}/api/stats`);
                const data = await res.json();
                
                animateValue("total-winners", 0, data.total_winners, 1000);
                
                // Estimates based on winners count (since we don't have explicit totals in stats api)
                const draws = Math.floor(data.total_winners / 1000); 
                document.getElementById('total-draws').innerText = draws.toLocaleString();
                
                const amount = data.by_position.reduce((acc, curr) => acc + curr.total_amount, 0);
                document.getElementById('total-amount').innerText = formatCompact(amount);
            } catch (err) { console.error("Stats error", err); }
        }

        // 4. QUICK SEARCH
        async function triggerSearch(explicitNum = null) {
            const num = explicitNum || document.getElementById('bond-number').value.trim();
            if(!num || num.length !== 6) {
                if (!explicitNum) alert("Please enter a valid 6-digit bond number");
                return;
            }

            // Create a custom data source for the grid for search mode
            bondGrid.updateConfig({
                pagination: { enabled: false }, 
                server: {
                    url: `${API_BASE}/api/search?number=${num}`,
                    then: data => {
                        if(!data.wins || data.wins.length === 0) {
                            alert("No records found for " + num);
                            return [];
                        }
                        return data.wins.map((w, index) => [index + 1, w.bond_number, w.denomination, w.prize_position, w.prize_amount, w.draw_date, w.draw_year])
                    },
                    total: data => data.total_wins
                }
            }).forceRender();
        }

        // Helpers
        function setupFilterListeners() {
            // We removed auto-listeners to use the "Apply" button for better control, 
            // but we can keep them for dropdowns if preferred. 
            // Let's keep them for seamless feel.
            document.getElementById('denom-filter').addEventListener('change', updateGridConfig);
            document.getElementById('rank-filter').addEventListener('change', updateGridConfig);
            document.getElementById('year-filter').addEventListener('change', updateGridConfig);
            document.getElementById('sort-filter').addEventListener('change', updateGridConfig);
            document.getElementById('start-date').addEventListener('change', updateGridConfig);
            document.getElementById('end-date').addEventListener('change', updateGridConfig);
            document.getElementById('min-amount').addEventListener('change', updateGridConfig);
            
            document.getElementById('row-limit').addEventListener('change', (e) => {
                const customInput = document.getElementById('custom-rows');
                if (e.target.value === 'custom') {
                    customInput.classList.remove('hidden');
                } else {
                    customInput.classList.add('hidden');
                    updateGridConfig();
                }
            });

            document.getElementById('custom-rows').addEventListener('change', updateGridConfig);
            
            // Bond Number Enter Key
            document.getElementById('bond-number').addEventListener('keyup', (e) => {
                if(e.key === 'Enter') updateGridConfig();
            });
            document.getElementById('bond-list').addEventListener('keyup', (e) => {
                if(e.key === 'Enter') updateGridConfig();
            });
            document.getElementById('start-bond').addEventListener('keyup', (e) => {
                if(e.key === 'Enter') updateGridConfig();
            });
            document.getElementById('end-bond').addEventListener('keyup', (e) => {
                if(e.key === 'Enter') updateGridConfig();
            });
        }

        function formatDate(dateStr) {
            if (!dateStr) return 'N/A';
            if (!dateStr.includes('-')) return dateStr;
            
            try {
                const parts = dateStr.split('-');
                if (parts.length !== 3) return dateStr;
                
                let day = parseInt(parts[0]);
                let monthStr = parts[1].trim();
                let year = parts[2].trim();
                
                let month;
                // Handle numeric month (01-12)
                if (!isNaN(monthStr)) {
                    month = parseInt(monthStr) - 1;
                } else {
                    // Handle textual month (Jan, Feb, etc.)
                    const months = {
                        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                    };
                    month = months[monthStr.toLowerCase().substring(0, 3)];
                }
                
                if (isNaN(day) || month === undefined || isNaN(month)) return dateStr;

                const date = new Date(year, month, day);
                if (isNaN(date.getTime())) return dateStr;
                
                const suffix = (d) => {
                    if (d > 3 && d < 21) return 'th';
                    switch (d % 10) {
                        case 1:  return "st";
                        case 2:  return "nd";
                        case 3:  return "rd";
                        default: return "th";
                    }
                }
                
                const monthName = date.toLocaleString('en-US', { month: 'short' });
                return `${day}${suffix(day)} ${monthName}, ${year}`;
            } catch (e) {
                return dateStr;
            }
        }

        async function copyToClipboard(text, el) {
            try {
                await navigator.clipboard.writeText(text);
                const tooltip = el.querySelector('.copy-tooltip');
                const originalText = tooltip.innerText;
                tooltip.innerText = 'Copied!';
                tooltip.style.opacity = '1';
                setTimeout(() => {
                    tooltip.innerText = originalText;
                    tooltip.style.opacity = '';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy: ', err);
            }
        }

        function formatCompact(num) {
            return Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
        }

        function animateValue(id, start, end, duration) {
            if (start === end) return;
            var obj = document.getElementById(id);
            if (!obj) return;
            
            var range = end - start;
            var current = start;
            var increment = end > start? Math.ceil(range / (duration / 10)) : Math.floor(range / (duration / 10));
            
            var timer = setInterval(function() {
                current += increment;
                if((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                    current = end;
                    clearInterval(timer);
                }
                obj.innerHTML = current.toLocaleString();
            }, 10);
        }

        // 5. PDF EXPORT FEATURE
        async function exportToPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'pt', 'a4');
            
            // Show loading state on button
            const btn = event.currentTarget;
            const originalContent = btn.innerHTML;
            btn.innerHTML = `<span class="animate-spin mr-2">◌</span> Generating...`;
            btn.disabled = true;

            try {
                // Construct URL with current filters to get ALL matching data (unlimited)
                const denom = document.getElementById('denom-filter').value;
                const rank = document.getElementById('rank-filter').value;
                const year = document.getElementById('year-filter').value;
                const sortBy = document.getElementById('sort-filter').value;
                const startDate = document.getElementById('start-date').value;
                const endDate = document.getElementById('end-date').value;
                const minAmount = document.getElementById('min-amount').value;
                
                let exportUrl = `${API_BASE}/api/draws?limit=5000&offset=0`; // High limit for export
                if (denom) exportUrl += `&denomination=${denom}`;
                if (rank) exportUrl += `&position=${rank}`;
                if (year) exportUrl += `&year=${year}`;
                if (sortBy) exportUrl += `&sort_by=${sortBy}`;
                if (startDate) exportUrl += `&start_date=${startDate}`;
                if (endDate) exportUrl += `&end_date=${endDate}`;
                if (minAmount) exportUrl += `&min_amount=${minAmount}`;

                const response = await fetch(exportUrl);
                const data = await response.json();
                
                if (!data.draws || data.draws.length === 0) {
                    alert("No data available to export with current filters.");
                    return;
                }

                // --- PDF Header Design ---
                doc.setFillColor(15, 23, 42); // Onyx 900
                doc.rect(0, 0, 595, 80, 'F'); // Increased height
                
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.text('BondCheck PRO', 40, 45); 
                
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                // Use right alignment with a safer margin
                doc.text('Prize Bond Report', 545, 40, { align: 'right' });
                doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), 545, 53, { align: 'right' });

                // Filter Summary
                doc.setTextColor(71, 85, 105);
                doc.setFontSize(8);
                let filterSummary = "FILTERS: " + [
                    denom ? `Denom: ${denom}` : "All Denoms",
                    year ? `Year: ${year}` : "All Years",
                    rank ? `Rank: ${rank}` : "All Ranks",
                    startDate ? `From: ${startDate}` : null,
                    endDate ? `To: ${endDate}` : null
                ].filter(Boolean).join(" | ");
                doc.text(filterSummary, 40, 105);

                // --- Table Generation ---
                const tableData = data.draws.map((d, index) => [
                    index + 1,
                    d.bond_number,
                    'Rs. ' + d.denomination,
                    d.prize_position,
                    'Rs. ' + (d.prize_amount || 0).toLocaleString(),
                    formatDate(d.draw_date)
                ]);

                doc.autoTable({
                    startY: 120,
                    head: [['#', 'Bond #', 'Denom', 'Rank', 'Prize Amount', 'Draw Date']],
                    body: tableData,
                    theme: 'striped',
                    headStyles: { 
                        fillColor: [15, 23, 42], 
                        textColor: [255, 255, 255],
                        fontSize: 9,
                        fontStyle: 'bold',
                        halign: 'center'
                    },
                    bodyStyles: { 
                        fontSize: 8,
                        valign: 'middle'
                    },
                    columnStyles: {
                        0: { halign: 'center', fontStyle: 'bold', cellWidth: 30 },
                        1: { halign: 'center', fontStyle: 'bold' },
                        2: { halign: 'center' },
                        3: { halign: 'center' },
                        4: { halign: 'right' },
                        5: { halign: 'center' }
                    },
                    margin: { left: 40, right: 40 },
                    didDrawPage: function (data) {
                        // --- Footer Design ---
                        const pageSize = doc.internal.pageSize;
                        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                        
                        doc.setDrawColor(226, 232, 240);
                        doc.line(40, pageHeight - 40, 555, pageHeight - 40);
                        
                        doc.setFontSize(8);
                        doc.setTextColor(148, 163, 184);
                        doc.text('bondcheckpro.internal', 40, pageHeight - 25);
                        
                        const str = "Page " + doc.internal.getNumberOfPages();
                        doc.text(str, 520, pageHeight - 25);
                    }
                });

                doc.save(`BondCheck_Report_${new Date().getTime()}.pdf`);

            } catch (error) {
                console.error("PDF Export Error:", error);
                alert("Failed to generate PDF. Check console for details.");
            } finally {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        }